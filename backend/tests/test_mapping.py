"""Unit tests for the JSON → crawl4ai config translation layer."""
import pytest

from app.core import mapping
from app.core.mapping import (
    MappingError,
    build_browser_config,
    build_crawler_config,
    build_deep_crawl_strategy,
    build_dispatcher,
    build_extraction_strategy,
    build_markdown_generator,
    build_seeding_config,
)
from app.models.schemas import (
    BrowserOptions,
    CrawlConfigPayload,
    DeepCrawlRequest,
    DeepFilterSpec,
    DispatcherOptions,
    ExtractionOptions,
    MarkdownOptions,
    RateLimitOptions,
    SeedRequest,
)


def test_browser_config_defaults():
    cfg = build_browser_config(BrowserOptions())
    assert cfg.headless is True
    assert cfg.browser_type == "chromium"


def test_browser_config_full():
    cfg = build_browser_config(
        BrowserOptions(
            browser_type="firefox",
            headless=False,
            viewport_width=1440,
            viewport_height=900,
            user_agent="TestUA",
            text_mode=True,
            enable_stealth=True,
            proxy_server="http://127.0.0.1:8080",
            proxy_username="u",
            proxy_password="p",
            cookies=[{"name": "a", "value": "b", "url": "https://x.com"}],
            headers={"X-Test": "1"},
        )
    )
    assert cfg.browser_type == "firefox"
    assert cfg.headless is False
    assert cfg.viewport_width == 1440
    assert cfg.user_agent == "TestUA"
    assert cfg.text_mode is True
    assert cfg.enable_stealth is True
    assert cfg.proxy_config.server == "http://127.0.0.1:8080"
    assert cfg.proxy_config.username == "u"
    assert cfg.cookies[0]["name"] == "a"
    assert cfg.headers["X-Test"] == "1"


def test_crawler_config_page_and_content():
    payload = CrawlConfigPayload.model_validate(
        {
            "page": {
                "wait_until": "networkidle",
                "page_timeout": 45000,
                "wait_for": "css:.done",
                "js_code": "window.scrollTo(0, 999)",
                "scan_full_page": True,
                "session_id": "sess1",
                "virtual_scroll": {"container_selector": "#feed", "scroll_count": 5},
            },
            "content": {
                "word_count_threshold": 5,
                "css_selector": "main",
                "excluded_tags": ["nav", "footer"],
                "exclude_external_links": True,
            },
            "capture": {
                "cache_mode": "bypass",
                "screenshot": True,
                "pdf": True,
                "capture_mhtml": True,
                "capture_console_messages": True,
                "fetch_ssl_certificate": True,
            },
        }
    )
    cfg = build_crawler_config(payload)
    assert cfg.wait_until == "networkidle"
    assert cfg.page_timeout == 45000
    assert cfg.wait_for == "css:.done"
    assert cfg.scan_full_page is True
    assert cfg.session_id == "sess1"
    assert cfg.virtual_scroll_config.container_selector == "#feed"
    assert cfg.word_count_threshold == 5
    assert cfg.css_selector == "main"
    assert "nav" in cfg.excluded_tags
    assert cfg.exclude_external_links is True
    assert cfg.screenshot is True
    assert cfg.pdf is True
    assert cfg.capture_mhtml is True
    assert cfg.capture_console_messages is True
    assert cfg.fetch_ssl_certificate is True
    from crawl4ai import CacheMode

    assert cfg.cache_mode == CacheMode.BYPASS


def test_markdown_generator_pruning():
    gen = build_markdown_generator(
        MarkdownOptions(content_filter="pruning", pruning_threshold=0.5, ignore_links=True),
        None,
    )
    from crawl4ai import PruningContentFilter

    assert isinstance(gen.content_filter, PruningContentFilter)
    assert gen.options.get("ignore_links") is True


def test_markdown_generator_bm25_requires_query():
    with pytest.raises(MappingError):
        build_markdown_generator(MarkdownOptions(content_filter="bm25"), None)


def test_markdown_generator_llm_requires_provider():
    with pytest.raises(MappingError):
        build_markdown_generator(MarkdownOptions(content_filter="llm"), None)


def test_extraction_css():
    schema = {"name": "t", "baseSelector": ".row", "fields": [{"name": "x", "selector": "a", "type": "text"}]}
    strat = build_extraction_strategy(
        ExtractionOptions.model_validate({"type": "css", "schema": schema}), None
    )
    from crawl4ai import JsonCssExtractionStrategy

    assert isinstance(strat, JsonCssExtractionStrategy)
    assert strat.schema["baseSelector"] == ".row"


def test_extraction_css_requires_schema():
    with pytest.raises(MappingError):
        build_extraction_strategy(ExtractionOptions(type="css"), None)


def test_extraction_regex_builtin_and_custom():
    strat = build_extraction_strategy(
        ExtractionOptions(type="regex", regex_builtin=["email", "url"], regex_custom={"sku": r"SKU-\d+"}),
        None,
    )
    from crawl4ai import RegexExtractionStrategy

    assert isinstance(strat, RegexExtractionStrategy)
    out = strat.extract("http://t", "mail me at a@b.com — SKU-42 at https://x.dev/page")
    labels = {row["label"] for row in out}
    assert {"email", "url", "sku"} <= labels


def test_extraction_llm_requires_provider():
    with pytest.raises(MappingError):
        build_extraction_strategy(ExtractionOptions(type="llm", llm_instruction="x"), None)


def test_deep_crawl_bfs_with_filters_and_scorer():
    req = DeepCrawlRequest(
        url="https://docs.example.com",
        strategy="bfs",
        max_depth=2,
        max_pages=10,
        score_threshold=0.3,
        keywords=["python", "api"],
        filters=[
            DeepFilterSpec(type="url_pattern", patterns=["*/docs/*"]),
            DeepFilterSpec(type="domain", allowed_domains=["docs.example.com"]),
            DeepFilterSpec(type="content_type", allowed_types=["text/html"]),
        ],
    )
    strat = build_deep_crawl_strategy(req)
    from crawl4ai import BFSDeepCrawlStrategy

    assert isinstance(strat, BFSDeepCrawlStrategy)
    assert strat.max_depth == 2
    assert strat.max_pages == 10
    assert strat.url_scorer is not None
    assert len(strat.filter_chain.filters) == 3


def test_deep_crawl_best_first():
    req = DeepCrawlRequest(url="https://x.com", strategy="best_first", max_depth=1, keywords=["a"])
    strat = build_deep_crawl_strategy(req)
    from crawl4ai import BestFirstCrawlingStrategy

    assert isinstance(strat, BestFirstCrawlingStrategy)


def test_deep_crawl_dfs():
    req = DeepCrawlRequest(url="https://x.com", strategy="dfs", max_depth=3)
    strat = build_deep_crawl_strategy(req)
    from crawl4ai import DFSDeepCrawlStrategy

    assert isinstance(strat, DFSDeepCrawlStrategy)


def test_dispatchers():
    from crawl4ai import MemoryAdaptiveDispatcher, SemaphoreDispatcher

    d1 = build_dispatcher(DispatcherOptions(type="memory_adaptive", max_session_permit=7))
    assert isinstance(d1, MemoryAdaptiveDispatcher)
    assert d1.max_session_permit == 7
    assert d1.rate_limiter is None

    d2 = build_dispatcher(
        DispatcherOptions(
            type="semaphore",
            semaphore_count=3,
            rate_limit=RateLimitOptions(enabled=True, base_delay_min=0.5, base_delay_max=1.5),
        )
    )
    assert isinstance(d2, SemaphoreDispatcher)
    assert d2.semaphore_count == 3
    assert d2.rate_limiter is not None
    assert d2.rate_limiter.base_delay == (0.5, 1.5)


def test_seeding_config_with_query_forces_head_extraction():
    cfg = build_seeding_config(
        SeedRequest(domains=["example.com"], source="sitemap", query="machine learning", score_threshold=0.3)
    )
    assert cfg.source == "sitemap"
    assert cfg.query == "machine learning"
    assert cfg.extract_head is True
    assert cfg.score_threshold == 0.3
    assert cfg.scoring_method == "bm25"


def test_regex_builtin_map_covers_all_defaults():
    from crawl4ai import RegexExtractionStrategy

    assert set(mapping.REGEX_BUILTIN_KEYS) == set(RegexExtractionStrategy.DEFAULT_PATTERNS.keys())

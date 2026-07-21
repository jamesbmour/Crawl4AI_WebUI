"""Translate JSON payloads (models/schemas.py) into crawl4ai config objects.

This is the single place where UI options meet the crawl4ai SDK. Every
function only forwards values the client explicitly set, so crawl4ai's own
defaults apply otherwise.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from crawl4ai import (
        BrowserConfig,
        CrawlerRunConfig,
        DefaultMarkdownGenerator,
        LLMConfig,
        SeedingConfig,
    )
    from crawl4ai.adaptive_crawler import AdaptiveConfig

from ..models.schemas import (
    AdaptiveRequest,
    BrowserOptions,
    CaptureOptions,
    ContentOptions,
    CrawlConfigPayload,
    DeepCrawlRequest,
    DeepFilterSpec,
    DispatcherOptions,
    ExtractionOptions,
    MarkdownOptions,
    PageOptions,
    SeedRequest,
)


class MappingError(ValueError):
    """Raised when a payload cannot be translated into crawl4ai objects."""


def _set_if(kwargs: dict[str, Any], key: str, value: Any) -> None:
    if value is not None:
        kwargs[key] = value


# ---------------------------------------------------------------------------
# Browser
# ---------------------------------------------------------------------------

def build_browser_config(opts: BrowserOptions) -> BrowserConfig:
    from crawl4ai import BrowserConfig

    kwargs: dict[str, Any] = {}
    _set_if(kwargs, "browser_type", opts.browser_type)
    _set_if(kwargs, "headless", opts.headless)
    _set_if(kwargs, "viewport_width", opts.viewport_width)
    _set_if(kwargs, "viewport_height", opts.viewport_height)
    _set_if(kwargs, "user_agent", opts.user_agent)
    _set_if(kwargs, "user_agent_mode", opts.user_agent_mode)
    _set_if(kwargs, "cookies", opts.cookies)
    _set_if(kwargs, "headers", opts.headers)
    _set_if(kwargs, "java_script_enabled", opts.java_script_enabled)
    _set_if(kwargs, "text_mode", opts.text_mode)
    _set_if(kwargs, "light_mode", opts.light_mode)
    _set_if(kwargs, "ignore_https_errors", opts.ignore_https_errors)
    _set_if(kwargs, "enable_stealth", opts.enable_stealth)
    _set_if(kwargs, "storage_state", opts.storage_state)
    _set_if(kwargs, "extra_args", opts.extra_args)
    if opts.proxy_server:
        proxy: dict[str, Any] = {"server": opts.proxy_server}
        if opts.proxy_username:
            proxy["username"] = opts.proxy_username
        if opts.proxy_password:
            proxy["password"] = opts.proxy_password
        kwargs["proxy_config"] = proxy
    # verbose logging stays server-side
    kwargs["verbose"] = False
    return BrowserConfig(**kwargs)


def browser_config_signature(opts: BrowserOptions) -> str:
    """Stable key used by the crawler pool to share browser instances."""
    return opts.model_dump_json(exclude_none=True)


# ---------------------------------------------------------------------------
# Markdown generation
# ---------------------------------------------------------------------------

def build_markdown_generator(
    opts: MarkdownOptions, llm_config: Optional[LLMConfig]
) -> Optional[DefaultMarkdownGenerator]:
    content_filter = None
    filter_kind = opts.content_filter or "none"
    if filter_kind == "pruning":
        from crawl4ai import PruningContentFilter

        kwargs: dict[str, Any] = {}
        _set_if(kwargs, "threshold", opts.pruning_threshold)
        _set_if(kwargs, "threshold_type", opts.pruning_threshold_type)
        _set_if(kwargs, "min_word_threshold", opts.pruning_min_word_threshold)
        content_filter = PruningContentFilter(**kwargs)
    elif filter_kind == "bm25":
        from crawl4ai import BM25ContentFilter

        if not opts.bm25_query:
            raise MappingError("BM25 content filter requires a query")
        kwargs = {"user_query": opts.bm25_query}
        _set_if(kwargs, "bm25_threshold", opts.bm25_threshold)
        content_filter = BM25ContentFilter(**kwargs)
    elif filter_kind == "llm":
        from crawl4ai import LLMContentFilter

        if llm_config is None:
            raise MappingError("LLM content filter requires an LLM provider (Settings)")
        content_filter = LLMContentFilter(
            llm_config=llm_config,
            instruction=opts.llm_filter_instruction
            or "Extract the main content, removing navigation, ads and boilerplate. Keep all substantive text as clean markdown.",
        )

    options: dict[str, Any] = {}
    _set_if(options, "ignore_links", opts.ignore_links)
    _set_if(options, "ignore_images", opts.ignore_images)
    _set_if(options, "escape_html", opts.escape_html)
    _set_if(options, "skip_internal_links", opts.skip_internal_links)
    _set_if(options, "body_width", opts.body_width)

    gen_kwargs: dict[str, Any] = {}
    if content_filter is not None:
        gen_kwargs["content_filter"] = content_filter
    if options:
        gen_kwargs["options"] = options
    if opts.content_source:
        gen_kwargs["content_source"] = opts.content_source
    if not gen_kwargs:
        return None  # let crawl4ai use its default generator
    from crawl4ai import DefaultMarkdownGenerator

    return DefaultMarkdownGenerator(**gen_kwargs)


# ---------------------------------------------------------------------------
# Extraction strategies
# ---------------------------------------------------------------------------

REGEX_BUILTIN_KEYS = [
    "email",
    "phone_intl",
    "phone_us",
    "url",
    "ipv4",
    "ipv6",
    "uuid",
    "currency",
    "percentage",
    "number",
    "date_iso",
    "date_us",
    "time_24h",
    "postal_us",
    "postal_uk",
    "html_color_hex",
    "twitter_handle",
    "hashtag",
    "mac_addr",
    "iban",
    "credit_card",
]


def _regex_builtin_map() -> dict[str, Any]:
    from crawl4ai import RegexExtractionStrategy

    return {
        "email": RegexExtractionStrategy.Email,
        "phone_intl": RegexExtractionStrategy.PhoneIntl,
        "phone_us": RegexExtractionStrategy.PhoneUS,
        "url": RegexExtractionStrategy.Url,
        "ipv4": RegexExtractionStrategy.IPv4,
        "ipv6": RegexExtractionStrategy.IPv6,
        "uuid": RegexExtractionStrategy.Uuid,
        "currency": RegexExtractionStrategy.Currency,
        "percentage": RegexExtractionStrategy.Percentage,
        "number": RegexExtractionStrategy.Number,
        "date_iso": RegexExtractionStrategy.DateIso,
        "date_us": RegexExtractionStrategy.DateUS,
        "time_24h": RegexExtractionStrategy.Time24h,
        "postal_us": RegexExtractionStrategy.PostalUS,
        "postal_uk": RegexExtractionStrategy.PostalUK,
        "html_color_hex": RegexExtractionStrategy.HexColor,
        "twitter_handle": RegexExtractionStrategy.TwitterHandle,
        "hashtag": RegexExtractionStrategy.Hashtag,
        "mac_addr": RegexExtractionStrategy.MacAddr,
        "iban": RegexExtractionStrategy.Iban,
        "credit_card": RegexExtractionStrategy.CreditCard,
    }


def build_extraction_strategy(
    opts: ExtractionOptions,
    llm_config: Optional[LLMConfig],
    resolved_schema: Optional[dict[str, Any]] = None,
):
    """resolved_schema: schema loaded from the library when schema_id was given."""
    kind = opts.type
    if kind == "none":
        return None

    if kind in ("css", "xpath"):
        from crawl4ai import JsonCssExtractionStrategy, JsonXPathExtractionStrategy

        schema = resolved_schema or opts.schema_json
        if not schema:
            raise MappingError(f"{kind} extraction requires a schema")
        cls = JsonCssExtractionStrategy if kind == "css" else JsonXPathExtractionStrategy
        return cls(schema)

    if kind == "regex":
        from crawl4ai import RegexExtractionStrategy

        regex_builtin_map = _regex_builtin_map()
        pattern = RegexExtractionStrategy.Nothing
        for key in opts.regex_builtin or []:
            flag = regex_builtin_map.get(key)
            if flag is None:
                raise MappingError(f"Unknown builtin regex pattern: {key}")
            pattern |= flag
        custom = opts.regex_custom or None
        if pattern == RegexExtractionStrategy.Nothing and not custom:
            raise MappingError("Regex extraction requires at least one pattern")
        return RegexExtractionStrategy(pattern=pattern, custom=custom)

    if kind == "llm":
        from crawl4ai import LLMExtractionStrategy

        if llm_config is None:
            raise MappingError("LLM extraction requires an LLM provider (Settings)")
        schema = resolved_schema or opts.llm_schema
        kwargs: dict[str, Any] = {"llm_config": llm_config}
        _set_if(kwargs, "instruction", opts.llm_instruction)
        _set_if(kwargs, "schema", schema)
        kwargs["extraction_type"] = opts.llm_extraction_type or ("schema" if schema else "block")
        _set_if(kwargs, "input_format", opts.llm_input_format)
        _set_if(kwargs, "chunk_token_threshold", opts.llm_chunk_token_threshold)
        _set_if(kwargs, "apply_chunking", opts.llm_apply_chunking)
        _set_if(kwargs, "force_json_response", opts.llm_force_json_response)
        return LLMExtractionStrategy(**kwargs)

    raise MappingError(f"Unknown extraction type: {kind}")


# ---------------------------------------------------------------------------
# CrawlerRunConfig
# ---------------------------------------------------------------------------

def _apply_page_options(kwargs: dict[str, Any], page: PageOptions) -> None:
    _set_if(kwargs, "wait_until", page.wait_until)
    _set_if(kwargs, "page_timeout", page.page_timeout)
    _set_if(kwargs, "wait_for", page.wait_for)
    _set_if(kwargs, "wait_for_timeout", page.wait_for_timeout)
    _set_if(kwargs, "wait_for_images", page.wait_for_images)
    _set_if(kwargs, "delay_before_return_html", page.delay_before_return_html)
    _set_if(kwargs, "js_code", page.js_code)
    _set_if(kwargs, "js_only", page.js_only)
    _set_if(kwargs, "session_id", page.session_id)
    _set_if(kwargs, "scan_full_page", page.scan_full_page)
    _set_if(kwargs, "scroll_delay", page.scroll_delay)
    _set_if(kwargs, "max_scroll_steps", page.max_scroll_steps)
    _set_if(kwargs, "process_iframes", page.process_iframes)
    _set_if(kwargs, "remove_overlay_elements", page.remove_overlay_elements)
    _set_if(kwargs, "simulate_user", page.simulate_user)
    _set_if(kwargs, "override_navigator", page.override_navigator)
    _set_if(kwargs, "magic", page.magic)
    _set_if(kwargs, "adjust_viewport_to_content", page.adjust_viewport_to_content)
    _set_if(kwargs, "locale", page.locale)
    _set_if(kwargs, "timezone_id", page.timezone_id)
    if page.geolocation_latitude is not None and page.geolocation_longitude is not None:
        from crawl4ai import GeolocationConfig

        kwargs["geolocation"] = GeolocationConfig(
            latitude=page.geolocation_latitude, longitude=page.geolocation_longitude
        )
    if page.virtual_scroll is not None:
        from crawl4ai import VirtualScrollConfig

        kwargs["virtual_scroll_config"] = VirtualScrollConfig(
            container_selector=page.virtual_scroll.container_selector,
            scroll_count=page.virtual_scroll.scroll_count,
            scroll_by=page.virtual_scroll.scroll_by,
            wait_after_scroll=page.virtual_scroll.wait_after_scroll,
        )


def _apply_content_options(kwargs: dict[str, Any], content: ContentOptions) -> None:
    _set_if(kwargs, "word_count_threshold", content.word_count_threshold)
    _set_if(kwargs, "css_selector", content.css_selector)
    _set_if(kwargs, "target_elements", content.target_elements)
    _set_if(kwargs, "excluded_tags", content.excluded_tags)
    _set_if(kwargs, "excluded_selector", content.excluded_selector)
    _set_if(kwargs, "only_text", content.only_text)
    _set_if(kwargs, "keep_data_attributes", content.keep_data_attributes)
    _set_if(kwargs, "remove_forms", content.remove_forms)
    _set_if(kwargs, "exclude_external_links", content.exclude_external_links)
    _set_if(kwargs, "exclude_internal_links", content.exclude_internal_links)
    _set_if(kwargs, "exclude_social_media_links", content.exclude_social_media_links)
    _set_if(kwargs, "exclude_domains", content.exclude_domains)
    _set_if(kwargs, "exclude_external_images", content.exclude_external_images)
    _set_if(kwargs, "exclude_all_images", content.exclude_all_images)
    _set_if(kwargs, "image_score_threshold", content.image_score_threshold)
    _set_if(kwargs, "table_score_threshold", content.table_score_threshold)
    _set_if(kwargs, "check_robots_txt", content.check_robots_txt)


def _apply_capture_options(kwargs: dict[str, Any], capture: CaptureOptions) -> None:
    if capture.cache_mode:
        from crawl4ai import CacheMode

        cache_modes = {
            "enabled": CacheMode.ENABLED,
            "bypass": CacheMode.BYPASS,
            "disabled": CacheMode.DISABLED,
            "read_only": CacheMode.READ_ONLY,
            "write_only": CacheMode.WRITE_ONLY,
        }
        kwargs["cache_mode"] = cache_modes[capture.cache_mode]
    _set_if(kwargs, "screenshot", capture.screenshot)
    _set_if(kwargs, "screenshot_wait_for", capture.screenshot_wait_for)
    _set_if(kwargs, "pdf", capture.pdf)
    _set_if(kwargs, "capture_mhtml", capture.capture_mhtml)
    _set_if(kwargs, "capture_network_requests", capture.capture_network_requests)
    _set_if(kwargs, "capture_console_messages", capture.capture_console_messages)
    _set_if(kwargs, "fetch_ssl_certificate", capture.fetch_ssl_certificate)


def build_crawler_config(
    payload: CrawlConfigPayload,
    llm_config: Optional[LLMConfig] = None,
    resolved_schema: Optional[dict[str, Any]] = None,
    stream: Optional[bool] = None,
    deep_crawl_strategy: Any = None,
) -> CrawlerRunConfig:
    from crawl4ai import CrawlerRunConfig

    kwargs: dict[str, Any] = {"verbose": False}
    _apply_page_options(kwargs, payload.page)
    _apply_content_options(kwargs, payload.content)
    _apply_capture_options(kwargs, payload.capture)

    md_gen = build_markdown_generator(payload.markdown, llm_config)
    if md_gen is not None:
        kwargs["markdown_generator"] = md_gen

    strategy = build_extraction_strategy(payload.extraction, llm_config, resolved_schema)
    if strategy is not None:
        kwargs["extraction_strategy"] = strategy

    if stream is not None:
        kwargs["stream"] = stream
    if deep_crawl_strategy is not None:
        kwargs["deep_crawl_strategy"] = deep_crawl_strategy
    return CrawlerRunConfig(**kwargs)


# ---------------------------------------------------------------------------
# Deep crawl
# ---------------------------------------------------------------------------

def _build_filter(spec: DeepFilterSpec):
    if spec.type == "url_pattern":
        from crawl4ai import URLPatternFilter

        if not spec.patterns:
            raise MappingError("url_pattern filter requires patterns")
        return URLPatternFilter(patterns=spec.patterns, reverse=bool(spec.reverse))
    if spec.type == "domain":
        from crawl4ai import DomainFilter

        if not spec.allowed_domains and not spec.blocked_domains:
            raise MappingError("domain filter requires allowed or blocked domains")
        return DomainFilter(
            allowed_domains=spec.allowed_domains or None,
            blocked_domains=spec.blocked_domains or None,
        )
    if spec.type == "content_type":
        from crawl4ai import ContentTypeFilter

        if not spec.allowed_types:
            raise MappingError("content_type filter requires allowed types")
        return ContentTypeFilter(allowed_types=spec.allowed_types)
    if spec.type == "content_relevance":
        from crawl4ai.deep_crawling.filters import ContentRelevanceFilter

        if not spec.query:
            raise MappingError("content_relevance filter requires a query")
        return ContentRelevanceFilter(query=spec.query, threshold=spec.threshold or 0.7)
    if spec.type == "seo":
        from crawl4ai import SEOFilter

        kwargs: dict[str, Any] = {"threshold": spec.threshold or 0.5}
        if spec.keywords:
            kwargs["keywords"] = spec.keywords
        return SEOFilter(**kwargs)
    raise MappingError(f"Unknown filter type: {spec.type}")


def build_deep_crawl_strategy(req: DeepCrawlRequest):
    from crawl4ai import (
        BFSDeepCrawlStrategy,
        BestFirstCrawlingStrategy,
        DFSDeepCrawlStrategy,
        FilterChain,
        KeywordRelevanceScorer,
    )

    filter_chain = FilterChain([_build_filter(f) for f in req.filters])
    scorer = None
    if req.keywords:
        scorer = KeywordRelevanceScorer(keywords=req.keywords, weight=req.keyword_weight)

    common: dict[str, Any] = {
        "max_depth": req.max_depth,
        "filter_chain": filter_chain,
        "url_scorer": scorer,
        "include_external": req.include_external,
    }
    if req.max_pages is not None:
        common["max_pages"] = req.max_pages

    if req.strategy == "bfs":
        if req.score_threshold is not None:
            common["score_threshold"] = req.score_threshold
        return BFSDeepCrawlStrategy(**common)
    if req.strategy == "dfs":
        if req.score_threshold is not None:
            common["score_threshold"] = req.score_threshold
        return DFSDeepCrawlStrategy(**common)
    if req.strategy == "best_first":
        # BestFirst has no score_threshold param — the priority queue handles ordering.
        return BestFirstCrawlingStrategy(**common)
    raise MappingError(f"Unknown deep crawl strategy: {req.strategy}")


# ---------------------------------------------------------------------------
# Dispatchers (arun_many)
# ---------------------------------------------------------------------------

def build_dispatcher(opts: DispatcherOptions):
    from crawl4ai import (
        MemoryAdaptiveDispatcher,
        RateLimiter,
        SemaphoreDispatcher,
    )

    rate_limiter = None
    if opts.rate_limit.enabled:
        rate_limiter = RateLimiter(
            base_delay=(opts.rate_limit.base_delay_min, opts.rate_limit.base_delay_max),
            max_delay=opts.rate_limit.max_delay,
            max_retries=opts.rate_limit.max_retries,
        )
    if opts.type == "semaphore":
        return SemaphoreDispatcher(
            semaphore_count=opts.semaphore_count, rate_limiter=rate_limiter
        )
    return MemoryAdaptiveDispatcher(
        memory_threshold_percent=opts.memory_threshold_percent,
        max_session_permit=opts.max_session_permit,
        rate_limiter=rate_limiter,
    )


# ---------------------------------------------------------------------------
# URL seeding / adaptive
# ---------------------------------------------------------------------------

def build_seeding_config(req: SeedRequest) -> SeedingConfig:
    from crawl4ai import SeedingConfig

    kwargs: dict[str, Any] = {
        "source": req.source,
        "pattern": req.pattern or "*",
        "live_check": req.live_check,
        "extract_head": req.extract_head,
        "max_urls": req.max_urls,
        "concurrency": req.concurrency,
        "hits_per_sec": req.hits_per_sec,
        "force": req.force,
        "verbose": False,
    }
    if req.query:
        kwargs["query"] = req.query
        kwargs["scoring_method"] = "bm25"
        # BM25 scoring needs head metadata
        kwargs["extract_head"] = True
        if req.score_threshold is not None:
            kwargs["score_threshold"] = req.score_threshold
    return SeedingConfig(**kwargs)


def build_adaptive_config(req: AdaptiveRequest) -> AdaptiveConfig:
    from crawl4ai.adaptive_crawler import AdaptiveConfig

    return AdaptiveConfig(
        confidence_threshold=req.confidence_threshold,
        max_depth=req.max_depth,
        max_pages=req.max_pages,
        top_k_links=req.top_k_links,
        min_gain_threshold=req.min_gain_threshold,
        strategy=req.strategy,
    )

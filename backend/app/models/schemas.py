"""Pydantic request/response models.

Field names intentionally mirror crawl4ai's BrowserConfig / CrawlerRunConfig
parameters so the mapping layer (core/mapping.py) stays a thin translation.
All fields are optional; only values the client actually sets are forwarded.
"""
from __future__ import annotations

from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Config option groups
# ---------------------------------------------------------------------------

class BrowserOptions(BaseModel):
    browser_type: Optional[Literal["chromium", "firefox", "webkit"]] = None
    headless: Optional[bool] = None
    viewport_width: Optional[int] = None
    viewport_height: Optional[int] = None
    user_agent: Optional[str] = None
    user_agent_mode: Optional[Literal["random"]] = None
    proxy_server: Optional[str] = None
    proxy_username: Optional[str] = None
    proxy_password: Optional[str] = None
    cookies: Optional[list[dict[str, Any]]] = None
    headers: Optional[dict[str, str]] = None
    java_script_enabled: Optional[bool] = None
    text_mode: Optional[bool] = None
    light_mode: Optional[bool] = None
    ignore_https_errors: Optional[bool] = None
    enable_stealth: Optional[bool] = None
    storage_state: Optional[dict[str, Any]] = None
    extra_args: Optional[list[str]] = None


class VirtualScrollOptions(BaseModel):
    container_selector: str
    scroll_count: int = 10
    scroll_by: Union[str, int] = "container_height"
    wait_after_scroll: float = 0.5


class PageOptions(BaseModel):
    wait_until: Optional[Literal["domcontentloaded", "networkidle", "load", "commit"]] = None
    page_timeout: Optional[int] = None
    wait_for: Optional[str] = None
    wait_for_timeout: Optional[int] = None
    wait_for_images: Optional[bool] = None
    delay_before_return_html: Optional[float] = None
    js_code: Optional[Union[str, list[str]]] = None
    js_only: Optional[bool] = None
    session_id: Optional[str] = None
    scan_full_page: Optional[bool] = None
    scroll_delay: Optional[float] = None
    max_scroll_steps: Optional[int] = None
    virtual_scroll: Optional[VirtualScrollOptions] = None
    process_iframes: Optional[bool] = None
    remove_overlay_elements: Optional[bool] = None
    simulate_user: Optional[bool] = None
    override_navigator: Optional[bool] = None
    magic: Optional[bool] = None
    adjust_viewport_to_content: Optional[bool] = None
    locale: Optional[str] = None
    timezone_id: Optional[str] = None
    geolocation_latitude: Optional[float] = None
    geolocation_longitude: Optional[float] = None


class ContentOptions(BaseModel):
    word_count_threshold: Optional[int] = None
    css_selector: Optional[str] = None
    target_elements: Optional[list[str]] = None
    excluded_tags: Optional[list[str]] = None
    excluded_selector: Optional[str] = None
    only_text: Optional[bool] = None
    keep_data_attributes: Optional[bool] = None
    remove_forms: Optional[bool] = None
    exclude_external_links: Optional[bool] = None
    exclude_internal_links: Optional[bool] = None
    exclude_social_media_links: Optional[bool] = None
    exclude_domains: Optional[list[str]] = None
    exclude_external_images: Optional[bool] = None
    exclude_all_images: Optional[bool] = None
    image_score_threshold: Optional[int] = None
    table_score_threshold: Optional[int] = None
    check_robots_txt: Optional[bool] = None


class MarkdownOptions(BaseModel):
    content_source: Optional[Literal["cleaned_html", "raw_html", "fit_html"]] = None
    content_filter: Optional[Literal["none", "pruning", "bm25", "llm"]] = None
    # pruning
    pruning_threshold: Optional[float] = None
    pruning_threshold_type: Optional[Literal["fixed", "dynamic"]] = None
    pruning_min_word_threshold: Optional[int] = None
    # bm25
    bm25_query: Optional[str] = None
    bm25_threshold: Optional[float] = None
    # llm filter
    llm_filter_instruction: Optional[str] = None
    # html2text generator options
    ignore_links: Optional[bool] = None
    ignore_images: Optional[bool] = None
    escape_html: Optional[bool] = None
    skip_internal_links: Optional[bool] = None
    body_width: Optional[int] = None


class CaptureOptions(BaseModel):
    cache_mode: Optional[Literal["enabled", "bypass", "disabled", "read_only", "write_only"]] = None
    screenshot: Optional[bool] = None
    screenshot_wait_for: Optional[float] = None
    pdf: Optional[bool] = None
    capture_mhtml: Optional[bool] = None
    capture_network_requests: Optional[bool] = None
    capture_console_messages: Optional[bool] = None
    fetch_ssl_certificate: Optional[bool] = None


class ExtractionOptions(BaseModel):
    type: Literal["none", "css", "xpath", "regex", "llm"] = "none"
    # css / xpath
    schema_json: Optional[dict[str, Any]] = Field(default=None, alias="schema")
    schema_id: Optional[int] = None  # load a saved schema from the library
    # regex
    regex_builtin: Optional[list[str]] = None  # e.g. ["email", "url", "currency"]
    regex_custom: Optional[dict[str, str]] = None  # {label: pattern}
    # llm
    llm_instruction: Optional[str] = None
    llm_schema: Optional[dict[str, Any]] = None
    llm_extraction_type: Optional[Literal["block", "schema"]] = None
    llm_input_format: Optional[Literal["markdown", "html", "fit_markdown", "fit_html"]] = None
    llm_chunk_token_threshold: Optional[int] = None
    llm_apply_chunking: Optional[bool] = None
    llm_force_json_response: Optional[bool] = None

    model_config = {"populate_by_name": True}


class CrawlConfigPayload(BaseModel):
    """The full shared config accordion — used by scrape, batch and deep crawl."""
    browser: BrowserOptions = Field(default_factory=BrowserOptions)
    page: PageOptions = Field(default_factory=PageOptions)
    content: ContentOptions = Field(default_factory=ContentOptions)
    markdown: MarkdownOptions = Field(default_factory=MarkdownOptions)
    capture: CaptureOptions = Field(default_factory=CaptureOptions)
    extraction: ExtractionOptions = Field(default_factory=ExtractionOptions)


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------

class CrawlRequest(BaseModel):
    url: str
    config: CrawlConfigPayload = Field(default_factory=CrawlConfigPayload)


class RateLimitOptions(BaseModel):
    enabled: bool = False
    base_delay_min: float = 1.0
    base_delay_max: float = 3.0
    max_delay: float = 60.0
    max_retries: int = 3


class DispatcherOptions(BaseModel):
    type: Literal["memory_adaptive", "semaphore"] = "memory_adaptive"
    # memory adaptive
    memory_threshold_percent: float = 90.0
    max_session_permit: int = 10
    # semaphore
    semaphore_count: int = 5
    rate_limit: RateLimitOptions = Field(default_factory=RateLimitOptions)


class BatchCrawlRequest(BaseModel):
    urls: list[str]
    config: CrawlConfigPayload = Field(default_factory=CrawlConfigPayload)
    dispatcher: DispatcherOptions = Field(default_factory=DispatcherOptions)


class DeepFilterSpec(BaseModel):
    type: Literal["url_pattern", "domain", "content_type", "content_relevance", "seo"]
    # url_pattern
    patterns: Optional[list[str]] = None
    reverse: Optional[bool] = None
    # domain
    allowed_domains: Optional[list[str]] = None
    blocked_domains: Optional[list[str]] = None
    # content_type
    allowed_types: Optional[list[str]] = None
    # content_relevance
    query: Optional[str] = None
    threshold: Optional[float] = None
    # seo
    keywords: Optional[list[str]] = None


class DeepCrawlRequest(BaseModel):
    url: str
    strategy: Literal["bfs", "dfs", "best_first"] = "bfs"
    max_depth: int = 2
    max_pages: Optional[int] = 50
    include_external: bool = False
    score_threshold: Optional[float] = None
    keywords: Optional[list[str]] = None  # KeywordRelevanceScorer
    keyword_weight: float = 0.7
    filters: list[DeepFilterSpec] = Field(default_factory=list)
    config: CrawlConfigPayload = Field(default_factory=CrawlConfigPayload)


class SeedRequest(BaseModel):
    domains: list[str]
    source: Literal["sitemap", "cc", "sitemap+cc"] = "sitemap"
    pattern: str = "*"
    query: Optional[str] = None
    score_threshold: Optional[float] = None
    live_check: bool = False
    extract_head: bool = False
    max_urls: int = 500
    concurrency: int = 50
    hits_per_sec: int = 5
    force: bool = False


class AdaptiveRequest(BaseModel):
    start_url: str
    query: str
    strategy: Literal["statistical", "embedding"] = "statistical"
    confidence_threshold: float = 0.7
    max_depth: int = 5
    max_pages: int = 20
    top_k_links: int = 3
    min_gain_threshold: float = 0.1


class SchemaGenerateRequest(BaseModel):
    url: Optional[str] = None
    html: Optional[str] = None
    query: Optional[str] = None
    schema_type: Literal["CSS", "XPATH"] = "CSS"
    target_json_example: Optional[str] = None


class AskRequest(BaseModel):
    job_id: Optional[str] = None
    url: Optional[str] = None
    question: str
    history: list[dict[str, str]] = Field(default_factory=list)


class SavedSchemaIn(BaseModel):
    name: str
    description: Optional[str] = None
    kind: Literal["css", "xpath", "regex", "llm"] = "css"
    payload: dict[str, Any]


class ProfileIn(BaseModel):
    name: str
    description: Optional[str] = None
    config: CrawlConfigPayload


class SettingsIn(BaseModel):
    llm_provider: Optional[str] = None
    llm_api_token: Optional[str] = None
    llm_base_url: Optional[str] = None
    llm_temperature: Optional[float] = None
    llm_max_tokens: Optional[int] = None
    default_crawl_config: Optional[CrawlConfigPayload] = None

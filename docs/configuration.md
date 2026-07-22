# Configuration Reference

The **shared config object** (`config`) is used by the Scrape, Batch, Deep, and Extraction
flows. It is a direct mirror of crawl4ai's `BrowserConfig` / `CrawlerRunConfig` parameters,
split into six groups. Every field is optional — the backend only forwards values you actually
set, so anything omitted uses crawl4ai's own default.

```
config = { browser, page, content, markdown, capture, extraction }
```

Source of truth: `backend/app/models/schemas.py` (shapes) and `backend/app/core/mapping.py`
(how each field maps onto a crawl4ai object).

---

## `browser` — engine, identity, context

Mapped by `build_browser_config` → `crawl4ai.BrowserConfig`.

| Field | Type | Notes |
|-------|------|-------|
| `browser_type` | `"chromium" \| "firefox" \| "webkit"` | Playwright engine |
| `headless` | bool | Run without a visible window (default on) |
| `viewport_width` / `viewport_height` | int | Viewport size |
| `user_agent` | string | Custom UA string |
| `user_agent_mode` | `"random"` | Generate a random valid UA |
| `proxy_server` | string | `http://host:port`; combined with `proxy_username`/`proxy_password` into `proxy_config` |
| `proxy_username` / `proxy_password` | string | Proxy auth |
| `cookies` | list of dicts | Injected cookies |
| `headers` | dict | Extra HTTP headers |
| `java_script_enabled` | bool | Toggle JS execution |
| `text_mode` | bool | Disable images/rich content for speed |
| `light_mode` | bool | Disable background browser features |
| `ignore_https_errors` | bool | Accept invalid TLS |
| `enable_stealth` | bool | playwright-stealth patches to reduce bot detection |
| `storage_state` | dict | Pre-seeded storage state (auth) |
| `extra_args` | list of strings | Raw browser CLI args |

> The browser config's canonical JSON is also the **pool key** — crawls with identical browser
> options reuse the same live browser (and thus support `session_id` continuity).

---

## `page` — navigation & interaction

Mapped by `_apply_page_options` → `CrawlerRunConfig`.

| Field | Type | Notes |
|-------|------|-------|
| `wait_until` | `"domcontentloaded" \| "networkidle" \| "load" \| "commit"` | Navigation wait condition |
| `page_timeout` | int (ms) | Overall page timeout |
| `wait_for` | string | CSS/JS predicate to wait for |
| `wait_for_timeout` | int (ms) | Timeout for `wait_for` |
| `wait_for_images` | bool | Wait for images to load |
| `delay_before_return_html` | float (s) | Extra settle delay |
| `js_code` | string \| list of strings | JavaScript to execute on the page |
| `js_only` | bool | Re-run JS in an existing session without re-navigating |
| `session_id` | string | Reuse a browser session across calls |
| `scan_full_page` | bool | Auto-scroll the whole page |
| `scroll_delay` | float | Delay between scroll steps |
| `max_scroll_steps` | int | Cap on auto-scroll steps |
| `virtual_scroll` | object | Virtualized-list scrolling (see below) |
| `process_iframes` | bool | Inline iframe content |
| `remove_overlay_elements` | bool | Strip modals/overlays |
| `simulate_user` | bool | Human-like interaction |
| `override_navigator` | bool | Spoof navigator properties |
| `magic` | bool | crawl4ai's "just make it work" bundle |
| `adjust_viewport_to_content` | bool | Resize viewport to content |
| `locale` | string | Browser locale |
| `timezone_id` | string | Browser timezone |
| `geolocation_latitude` / `geolocation_longitude` | float | Both required → builds a `GeolocationConfig` |

**`virtual_scroll`** object → `VirtualScrollConfig`:
```json
{ "container_selector": "#feed", "scroll_count": 10,
  "scroll_by": "container_height", "wait_after_scroll": 0.5 }
```
(`scroll_by` may be a number of pixels or `"container_height"`.)

---

## `content` — cleaning & filtering

Mapped by `_apply_content_options` → `CrawlerRunConfig`.

| Field | Type | Notes |
|-------|------|-------|
| `word_count_threshold` | int | Minimum words for a block to survive |
| `css_selector` | string | Restrict crawl to a selector |
| `target_elements` | list | Only extract these elements |
| `excluded_tags` | list | Drop these tags |
| `excluded_selector` | string | Drop matching elements |
| `only_text` | bool | Text-only output |
| `keep_data_attributes` | bool | Preserve `data-*` |
| `remove_forms` | bool | Strip `<form>` |
| `exclude_external_links` / `exclude_internal_links` / `exclude_social_media_links` | bool | Link filtering |
| `exclude_domains` | list | Drop links to these domains |
| `exclude_external_images` / `exclude_all_images` | bool | Image filtering |
| `image_score_threshold` / `table_score_threshold` | int | Relevance cutoffs |
| `check_robots_txt` | bool | Respect robots.txt |

---

## `markdown` — markdown generation & filtering

Mapped by `build_markdown_generator` → `DefaultMarkdownGenerator` (+ a content filter). If no
markdown field is set, crawl4ai's default generator is used.

| Field | Type | Notes |
|-------|------|-------|
| `content_source` | `"cleaned_html" \| "raw_html" \| "fit_html"` | Which HTML feeds the generator |
| `content_filter` | `"none" \| "pruning" \| "bm25" \| "llm"` | Filter strategy (below) |
| `ignore_links` / `ignore_images` / `escape_html` / `skip_internal_links` | bool | html2text generator options |
| `body_width` | int | Wrap width (0 = no wrap) |

**Content filters:**

- **`pruning`** → `PruningContentFilter`. Uses `pruning_threshold` (float),
  `pruning_threshold_type` (`"fixed" \| "dynamic"`), `pruning_min_word_threshold` (int).
- **`bm25`** → `BM25ContentFilter`. **Requires `bm25_query`** (else `422`); optional
  `bm25_threshold`.
- **`llm`** → `LLMContentFilter`. **Requires an LLM provider**. Uses `llm_filter_instruction`
  (falls back to a sensible default that strips nav/ads/boilerplate).

---

## `capture` — screenshots, PDFs, logs, caching

Mapped by `_apply_capture_options` → `CrawlerRunConfig`.

| Field | Type | Notes |
|-------|------|-------|
| `cache_mode` | `"enabled" \| "bypass" \| "disabled" \| "read_only" \| "write_only"` | Maps to `CacheMode` |
| `screenshot` | bool | Capture a PNG (stored as `screenshot.png`) |
| `screenshot_wait_for` | float | Delay before screenshot |
| `pdf` | bool | Generate a PDF (`page.pdf`) |
| `capture_mhtml` | bool | MHTML archive (`page.mhtml`) |
| `capture_network_requests` | bool | Record network (`network.json`) |
| `capture_console_messages` | bool | Record console (`console.json`) |
| `fetch_ssl_certificate` | bool | Include SSL cert details in the result |

---

## `extraction` — structured data extraction

Mapped by `build_extraction_strategy`. The `type` field selects the strategy:

| `type` | Strategy | Required fields |
|--------|----------|-----------------|
| `"none"` | (no extraction) | — |
| `"css"` | `JsonCssExtractionStrategy` | `schema` (or `schema_id`) |
| `"xpath"` | `JsonXPathExtractionStrategy` | `schema` (or `schema_id`) |
| `"regex"` | `RegexExtractionStrategy` | at least one of `regex_builtin` / `regex_custom` |
| `"llm"` | `LLMExtractionStrategy` | LLM provider configured |

**CSS / XPath fields**
- `schema` (JSON, aliased from `schema_json`) — the selector schema.
- `schema_id` (int) — load a saved schema from the library instead of inlining one. Resolved
  server-side before the crawl (`404` if the id is unknown).

**Regex fields**
- `regex_builtin` — list of keys from the 21 built-ins (see below); OR-combined into a pattern
  flag.
- `regex_custom` — `{ label: pattern }` map of custom regexes.

**LLM fields**
- `llm_instruction` — natural-language extraction prompt.
- `llm_schema` — optional JSON schema (or `schema_id`); presence implies `extraction_type="schema"`.
- `llm_extraction_type` — `"block" \| "schema"` (defaults based on whether a schema is present).
- `llm_input_format` — `"markdown" \| "html" \| "fit_markdown" \| "fit_html"`.
- `llm_chunk_token_threshold` (int), `llm_apply_chunking` (bool), `llm_force_json_response` (bool).

### Built-in regex patterns (`regex_builtin`)

```
email, phone_intl, phone_us, url, ipv4, ipv6, uuid, currency, percentage, number,
date_iso, date_us, time_24h, postal_us, postal_uk, html_color_hex, twitter_handle,
hashtag, mac_addr, iban, credit_card
```
(These 21 keys are also served by `GET /api/meta`.)

---

## Batch dispatcher (`dispatcher`)

Only used by `POST /api/crawl/batch`. Mapped by `build_dispatcher`.

```json
{
  "type": "memory_adaptive",       // "memory_adaptive" | "semaphore"
  "memory_threshold_percent": 90.0,// memory_adaptive: back off above this RAM %
  "max_session_permit": 10,        // memory_adaptive: max concurrent sessions
  "semaphore_count": 5,            // semaphore: fixed concurrency
  "rate_limit": {
    "enabled": false,
    "base_delay_min": 1.0,         // random delay range (seconds) between requests
    "base_delay_max": 3.0,
    "max_delay": 60.0,             // cap after backoff
    "max_retries": 3
  }
}
```

- **`memory_adaptive`** → `MemoryAdaptiveDispatcher` — scales concurrency down when system RAM
  crosses `memory_threshold_percent`.
- **`semaphore`** → `SemaphoreDispatcher` — fixed `semaphore_count` concurrency.
- When `rate_limit.enabled`, a `RateLimiter` is attached to either dispatcher.

---

## Deep-crawl parameters

Top-level fields of `POST /api/crawl/deep` (in addition to the shared `config`). Mapped by
`build_deep_crawl_strategy`.

| Field | Default | Notes |
|-------|---------|-------|
| `strategy` | `"bfs"` | `"bfs" \| "dfs" \| "best_first"` |
| `max_depth` | `2` | Link-following depth |
| `max_pages` | `50` | `null` = unlimited |
| `include_external` | `false` | Follow off-site links |
| `score_threshold` | `null` | Min URL score (bfs/dfs only; **ignored** for best_first) |
| `keywords` | `null` | Enables a `KeywordRelevanceScorer` |
| `keyword_weight` | `0.7` | Scorer weight |
| `filters` | `[]` | Filter chain (below) |

### Deep-crawl filters (`filters[]`)

Each entry has a `type` and type-specific fields; combined into a `FilterChain`.

| `type` | Fields | crawl4ai filter |
|--------|--------|-----------------|
| `url_pattern` | `patterns[]`, `reverse?` | `URLPatternFilter` |
| `domain` | `allowed_domains[]` / `blocked_domains[]` | `DomainFilter` |
| `content_type` | `allowed_types[]` | `ContentTypeFilter` |
| `content_relevance` | `query`, `threshold?` (0.7) | `ContentRelevanceFilter` |
| `seo` | `keywords[]?`, `threshold?` (0.5) | `SEOFilter` |

---

## Seeding parameters

Fields of `POST /api/seed`. Mapped by `build_seeding_config` → `SeedingConfig`.

| Field | Default | Notes |
|-------|---------|-------|
| `domains` | (required) | One or more domains |
| `source` | `"sitemap"` | `"sitemap" \| "cc" \| "sitemap+cc"` (cc = Common Crawl) |
| `pattern` | `"*"` | URL glob |
| `query` | `null` | Enables BM25 scoring (forces `extract_head=true`, `scoring_method="bm25"`) |
| `score_threshold` | `null` | Min BM25 score |
| `live_check` | `false` | HEAD-check each URL is alive |
| `extract_head` | `false` | Fetch `<head>` metadata (title etc.) |
| `max_urls` | `500` | Cap |
| `concurrency` | `50` | Parallel fetches |
| `hits_per_sec` | `5` | Rate cap |
| `force` | `false` | Bypass the seeder cache |

---

## Adaptive parameters

Fields of `POST /api/adaptive`. Mapped by `build_adaptive_config` → `AdaptiveConfig`.

| Field | Default | Notes |
|-------|---------|-------|
| `start_url` | (required) | Seed URL |
| `query` | (required) | The information need |
| `strategy` | `"statistical"` | `"statistical" \| "embedding"` |
| `confidence_threshold` | `0.7` | Stop once confidence ≥ this |
| `max_depth` | `5` | Depth cap |
| `max_pages` | `20` | Page cap |
| `top_k_links` | `3` | Links expanded per step |
| `min_gain_threshold` | `0.1` | Stop when expected info gain drops below this |

---

## App settings & environment

App-level settings (LLM provider, defaults) are stored in `data/settings.json`; see
[llm-integration.md](llm-integration.md). Relevant environment variables:

| Variable | Effect |
|----------|--------|
| `C4AI_WEBUI_DATA` | Overrides the data directory (DB, artifacts, settings). Falls back to `./data`, then `/tmp/c4ai-webui-data`. |
| `PORT` | Port `run.sh` binds uvicorn to (default `8742`). |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY` | Detected as a fallback so `llm_configured` can be true without storing a token in settings. |
| `PLAYWRIGHT_BROWSERS_PATH` | Where Playwright looks for browsers (set in the Docker image). |

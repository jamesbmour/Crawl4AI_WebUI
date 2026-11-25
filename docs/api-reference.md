# API Reference

All endpoints are mounted under the `/api` prefix. In development the Vite dev server proxies
`/api` to `http://127.0.0.1:8742`; in production the backend serves both the API and the SPA on
port `8742`.

- **Interactive docs:** with the backend running, Swagger UI is at `/docs` and ReDoc at
  `/redoc`.
- **Content type:** requests/responses are JSON unless noted (artifacts and `export.zip` return
  binary; `stream` returns `text/event-stream`).
- **Errors:** failures return `{ "detail": "<message>" }` with an appropriate status code.
  Common codes: `422` (invalid config / missing input), `404` (not found), `409` (job not
  running), `502` (upstream crawl/LLM/seeder failure).

## Endpoint index

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/meta` | Static metadata (crawl4ai version, regex pattern keys) |
| `POST` | `/api/crawl` | Single-URL crawl |
| `POST` | `/api/crawl/batch` | Batch crawl (`arun_many`) |
| `POST` | `/api/crawl/deep` | Recursive deep crawl |
| `POST` | `/api/adaptive` | Adaptive (information-foraging) crawl |
| `POST` | `/api/seed` | URL discovery via `AsyncUrlSeeder` |
| `POST` | `/api/schema/generate` | LLM-generate a CSS/XPath extraction schema |
| `POST` | `/api/ask` | Q&A over a job or URL |
| `GET` | `/api/jobs` | List jobs |
| `GET` | `/api/jobs/{id}` | Job detail |
| `GET` | `/api/jobs/{id}/results` | All result summaries for a job |
| `GET` | `/api/jobs/{id}/results/{index}` | One result by index |
| `GET` | `/api/jobs/{id}/stream` | SSE live progress stream |
| `POST` | `/api/jobs/{id}/cancel` | Cancel a running job |
| `DELETE` | `/api/jobs/{id}` | Delete a job (and its artifacts) |
| `GET` | `/api/jobs/{id}/artifacts/{index}/{name}` | Download one artifact |
| `GET` | `/api/jobs/{id}/export.zip` | Export a whole job as a ZIP |
| `GET` | `/api/schemas` · `POST` · `GET/PUT/DELETE /{id}` | Schema library CRUD |
| `GET` | `/api/profiles` · `POST` · `GET/PUT/DELETE /{id}` | Config profile CRUD |
| `GET` | `/api/settings` · `PUT /api/settings` | App/LLM settings |

---

## Health & metadata

### `GET /api/health`
```json
{ "ok": true }
```

### `GET /api/meta`
Static data the frontend needs at load time.
```json
{
  "crawl4ai_version": "0.7.6",
  "regex_builtin_patterns": ["email", "phone_intl", "phone_us", "url", "ipv4", "ipv6",
    "uuid", "currency", "percentage", "number", "date_iso", "date_us", "time_24h",
    "postal_us", "postal_uk", "html_color_hex", "twitter_handle", "hashtag", "mac_addr",
    "iban", "credit_card"]
}
```

---

## Crawl endpoints

All four return `{ "job_id": "<12-hex>" }` and run asynchronously. Subscribe to
`GET /api/jobs/{id}/stream` for progress. The shared `config` object is documented in full in
[configuration.md](configuration.md); only the top-level request shape is shown here.

### `POST /api/crawl` — single URL

```json
{
  "url": "https://example.com",
  "config": {
    "browser":    { "headless": true, "browser_type": "chromium" },
    "page":       { "wait_until": "networkidle", "js_code": "window.scrollTo(0, 9999)" },
    "content":    { "word_count_threshold": 10, "exclude_external_links": true },
    "markdown":   { "content_filter": "pruning", "pruning_threshold": 0.48 },
    "capture":    { "screenshot": true, "pdf": true, "cache_mode": "bypass" },
    "extraction": { "type": "css", "schema": { "name": "…", "baseSelector": "…", "fields": [] } }
  }
}
```
`config` and all its sub-objects are optional; omitted fields use crawl4ai defaults. If
`extraction.schema_id` is set, the saved schema is loaded from the library (404 if missing).
A `500` job failure surfaces via the SSE `status:failed` event; an invalid config returns `422`
synchronously.

### `POST /api/crawl/batch` — many URLs

```json
{
  "urls": ["https://a.com", "https://b.com"],
  "config": { … },
  "dispatcher": {
    "type": "memory_adaptive",
    "memory_threshold_percent": 90.0,
    "max_session_permit": 10,
    "semaphore_count": 5,
    "rate_limit": { "enabled": true, "base_delay_min": 1.0, "base_delay_max": 3.0,
                    "max_delay": 60.0, "max_retries": 3 }
  }
}
```
Blank/whitespace URLs are dropped; an empty list returns `422`. Results stream as each URL
finishes, with `completed` / `total` counters on `result` events.

### `POST /api/crawl/deep` — recursive

```json
{
  "url": "https://docs.example.com",
  "strategy": "bfs",              // "bfs" | "dfs" | "best_first"
  "max_depth": 2,
  "max_pages": 50,                // null for unlimited
  "include_external": false,
  "score_threshold": null,        // bfs/dfs only; ignored for best_first
  "keywords": ["python", "async"],// enables KeywordRelevanceScorer
  "keyword_weight": 0.7,
  "filters": [
    { "type": "url_pattern", "patterns": ["*/docs/*"], "reverse": false },
    { "type": "domain", "allowed_domains": ["docs.example.com"] },
    { "type": "content_type", "allowed_types": ["text/html"] },
    { "type": "content_relevance", "query": "async crawling", "threshold": 0.7 },
    { "type": "seo", "keywords": ["crawl"], "threshold": 0.5 }
  ],
  "config": { … }
}
```

### `POST /api/adaptive` — information foraging

```json
{
  "start_url": "https://docs.example.com",
  "query": "how to configure authentication hooks",
  "strategy": "statistical",      // "statistical" | "embedding"
  "confidence_threshold": 0.7,
  "max_depth": 5,
  "max_pages": 20,
  "top_k_links": 3,
  "min_gain_threshold": 0.1
}
```
On completion, an `adaptive_stats` SSE event and the job's `extra` column carry
`{ confidence, pages_crawled, metrics, crawl_order }`. The most relevant pages are stored as
results with a `relevant.md` artifact each.

---

## URL discovery

### `POST /api/seed`
```json
{
  "domains": ["docs.crawl4ai.com"],
  "source": "sitemap",            // "sitemap" | "cc" | "sitemap+cc"
  "pattern": "*/blog/*",
  "query": "async crawling examples",   // enables BM25 relevance scoring
  "score_threshold": 0.3,
  "live_check": false,
  "extract_head": false,
  "max_urls": 500,
  "concurrency": 50,
  "hits_per_sec": 5,
  "force": false
}
```
Runs synchronously (no job created). Response:
```json
{
  "domains": ["docs.crawl4ai.com"],
  "count": 42,
  "results": {
    "docs.crawl4ai.com": [
      { "url": "https://…", "status": 200, "relevance_score": 0.81, "title": "…" }
    ]
  }
}
```
Supplying `query` forces `extract_head` on (BM25 needs head metadata) and sets
`scoring_method="bm25"`. Seeder failures return `502`.

---

## Extraction & Ask (LLM)

Both require an LLM provider configured in Settings, else `422`.

### `POST /api/schema/generate`
Generate a CSS/XPath extraction schema from a page or raw HTML.
```json
{
  "url": "https://news.ycombinator.com",   // OR "html": "<html>…"
  "query": "posts with title, points, comment count",
  "schema_type": "CSS",                     // "CSS" | "XPATH"
  "target_json_example": "{ \"title\": \"…\", \"points\": 0 }"
}
```
If `html` is omitted, the URL is crawled (cache-enabled) and its cleaned HTML is used (truncated
to 120 000 chars). Response: `{ "schema": { … } }`.

### `POST /api/ask`
RAG-style Q&A over crawled content, via `litellm`.
```json
{
  "job_id": "ab12cd34ef56",   // OR "url": "https://example.com/article"
  "question": "What is this page about?",
  "history": [ { "role": "user", "content": "…" }, { "role": "assistant", "content": "…" } ]
}
```
When `job_id` is given, the job's stored markdown (`fit_markdown` preferred) becomes the
context; when `url` is given, the page is crawled on demand. Context is capped at 120 000 chars
and history to the last 10 turns. Response: `{ "answer": "…", "source": "job ab12…" | "<url>" }`.

---

## Jobs

### `GET /api/jobs?limit=100`
Newest-first list of job rows, each augmented with a live `running` boolean.
```json
[
  { "id": "ab12cd34ef56", "type": "batch", "status": "completed", "payload": { … },
    "error": null, "created_at": 1., "started_at": 1., "finished_at": 1.,
    "total_urls": 10, "completed_urls": 10, "extra": null, "running": false }
]
```

### `GET /api/jobs/{id}`
Single job row (same shape as above), `404` if unknown.

### `GET /api/jobs/{id}/results?full=false`
Array of per-URL result summaries in index order. With `full=false` (default) each entry is a
**slim** summary; with `full=true` you get the complete serialized `CrawlResult`.

Slim summary:
```json
{ "index": 0, "url": "https://…", "success": true, "status_code": 200,
  "error_message": null, "depth": 1, "score": 0.42, "markdown_length": 5123,
  "artifacts": ["result.md", "screenshot.png"] }
```
Full summary additionally includes `markdown`, `fit_markdown`, `markdown_with_citations`,
`references_markdown`, `cleaned_html`, `html` (unless > 1.5 MB, then `html_truncated: true`),
`links`, `media`, `tables`, `extracted_content`, `metadata`, `response_headers`,
`ssl_certificate`, `network_requests`, `console_messages`, and booleans `screenshot`/`pdf`/
`mhtml`. See [data-model.md](data-model.md#result-serialization).

### `GET /api/jobs/{id}/results/{index}`
The single full result with matching `index`, else `404`.

### `GET /api/jobs/{id}/stream`
Server-Sent Events. `Content-Type: text/event-stream`. See
[architecture.md](architecture.md#sse-event-types) for the event catalogue. Each event:
```
data: {"type":"result","ts":1720000000.1,"result":{…},"completed":3,"total":10}

: keepalive
```
The stream closes itself after a terminal `status` event. Late subscribers replay buffered (or
DB-persisted) events first.

### `POST /api/jobs/{id}/cancel`
Cancels the running asyncio task → `{ "ok": true }`. `409` if the job is not running.

### `DELETE /api/jobs/{id}`
Cancels if running, deletes the DB rows and the on-disk artifact directory → `{ "ok": true }`.

### `GET /api/jobs/{id}/artifacts/{index}/{name}?download=false`
Serves one artifact file with a guessed media type (`.png`, `.pdf`, `.md`, `.html`, `.json`,
`.mhtml`; else `application/octet-stream`). `download=1` adds a `Content-Disposition:
attachment` header. Paths are validated against traversal; unknown files return `404`.

### `GET /api/jobs/{id}/export.zip`
A ZIP containing `job.json`, `results.json` (full), and every artifact file under the job
directory. `Content-Disposition: attachment; filename="crawl_<id>.zip"`.

---

## Schema library

Saved extraction schemas, reusable across crawls via `extraction.schema_id`.

| Method | Path | Body / Result |
|--------|------|---------------|
| `GET` | `/api/schemas` | List (newest updated first) |
| `POST` | `/api/schemas` | `{ name, description?, kind, payload }` → `{ id }` |
| `GET` | `/api/schemas/{id}` | Full row, `404` if unknown |
| `PUT` | `/api/schemas/{id}` | Same body as POST → `{ ok: true }` (`404` if unknown) |
| `DELETE` | `/api/schemas/{id}` | `{ ok: true }` |

`kind` is `"css" | "xpath" | "regex" | "llm"`. `payload` is the arbitrary schema JSON.

## Config profiles

Named presets of the shared crawl `config`.

| Method | Path | Body / Result |
|--------|------|---------------|
| `GET` | `/api/profiles` | List |
| `POST` | `/api/profiles` | `{ name, description?, config }` → `{ id }` |
| `GET` | `/api/profiles/{id}` | Full row |
| `PUT` | `/api/profiles/{id}` | Same body → `{ ok: true }` |
| `DELETE` | `/api/profiles/{id}` | `{ ok: true }` |

`config` is stored with `exclude_none`, so only set fields persist.

---

## Settings

### `GET /api/settings`
Returns settings with the API token **masked** and a computed `llm_configured` flag.
```json
{ "llm_provider": "openai/gpt-4o-mini", "llm_api_token": "********abcd",
  "llm_base_url": "", "llm_temperature": null, "llm_max_tokens": null,
  "default_crawl_config": null, "llm_configured": true }
```

### `PUT /api/settings`
```json
{ "llm_provider": "openai/gpt-4o-mini", "llm_api_token": "sk-…",
  "llm_base_url": "", "llm_temperature": 0.2, "llm_max_tokens": 2048,
  "default_crawl_config": { … } }
```
Semantics:
- Fields sent as `null`/omitted are **not** changed.
- An **empty string** clears a value.
- A token that starts with `********` (the masked placeholder) is treated as "keep existing".

Returns the same masked shape as `GET`. See [llm-integration.md](llm-integration.md).

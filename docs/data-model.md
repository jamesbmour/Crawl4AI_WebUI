# Data Model & Storage

Crawl4AI Studio persists across three places, all under the resolved **data directory**
(`C4AI_WEBUI_DATA`, else `./data`, else `/tmp/c4ai-webui-data`):

```
data/
├── app.db            # SQLite: jobs, results, schemas, profiles  (WAL mode)
├── settings.json     # LLM provider config + default crawl config (mode 0600)
└── artifacts/
    └── <job_id>/
        └── <index>/  # one directory per result (per URL)
            ├── result.md          result.fit.md
            ├── page.html          cleaned.html
            ├── screenshot.png     page.pdf     page.mhtml
            ├── extracted.json
            └── network.json       console.json
```

The DB is opened once (`core/storage.py`) with `journal_mode=WAL`, `busy_timeout=5000`, and
`synchronous=NORMAL` — WAL lets job-list/detail reads proceed while a long deep crawl is writing
a result per page.

---

## SQLite schema

### `jobs`
| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | 12-hex UUID slice |
| `type` | TEXT | `scrape` \| `batch` \| `deep` \| `adaptive` |
| `status` | TEXT | `queued` \| `running` \| `completed` \| `failed` \| `cancelled` |
| `payload` | TEXT (JSON) | The original request (re-runnable) |
| `error` | TEXT | Failure message, if any |
| `created_at` / `started_at` / `finished_at` | REAL | Epoch seconds |
| `total_urls` / `completed_urls` | INTEGER | Progress counters |
| `extra` | TEXT (JSON) | Job-type extras (adaptive stats live here) |

### `results`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | Autoincrement |
| `job_id` | TEXT | FK-ish (indexed via `idx_results_job`) |
| `idx` | INTEGER | Per-job result index |
| `url` | TEXT | Result URL |
| `success` | INTEGER | 0/1 |
| `summary` | TEXT (JSON) | Full serialized result (see below) |
| `created_at` | REAL | Epoch seconds |

`add_result()` inserts a row and atomically bumps `jobs.completed_urls`.

### `schemas`
`id`, `name`, `description`, `kind` (`css`/`xpath`/`regex`/`llm`), `payload` (JSON),
`created_at`, `updated_at`.

### `profiles`
`id`, `name`, `description`, `config` (JSON, stored `exclude_none`), `created_at`, `updated_at`.

---

## Result serialization

`core/results.py::serialize_result` turns a crawl4ai `CrawlResult` into a JSON-safe dict and
writes the heavy/binary pieces to the artifact directory. The **full summary** stored in
`results.summary` contains:

| Field | Source | Artifact written |
|-------|--------|------------------|
| `index`, `url`, `redirected_url` | result | — |
| `success`, `status_code`, `error_message`, `session_id` | result | — |
| `metadata`, `response_headers` | result | — |
| `ssl_certificate` | normalized to a dict via `to_dict`/`to_json`/field fallback | — |
| `markdown` (raw) | `result.markdown.raw_markdown` | `result.md` |
| `fit_markdown` | `result.markdown.fit_markdown` | `result.fit.md` |
| `markdown_with_citations`, `references_markdown` | result.markdown | — |
| `html` | `result.html` (inline only if ≤ 1.5 MB, else `html_truncated: true`) | `page.html` |
| `cleaned_html` | `result.cleaned_html` (same 1.5 MB inline cap) | `cleaned.html` |
| `links`, `media`, `tables` | result | — |
| `extracted_content` | parsed from `result.extracted_content` | `extracted.json` |
| `screenshot` (bool) | base64 decoded | `screenshot.png` |
| `pdf` (bool) | result.pdf bytes | `page.pdf` |
| `mhtml` (bool) | result.mhtml | `page.mhtml` |
| `network_requests` (first 200), `network_requests_count` | result | `network.json` |
| `console_messages` | result | `console.json` |
| `artifacts` | list of filenames written | — |
| `depth`, `score` | `result.metadata.depth` / `.score` (deep crawl) | — |

The **slim summary** (`storage.slim_summary`) — used in job lists and streamed `result` events —
keeps only `index`, `url`, `success`, `status_code`, `error_message`, `depth`, `score`,
`markdown_length`, and `artifacts`. `GET /jobs/{id}/results?full=true` returns the full summary;
`full=false` (default) returns the slim one.

### Adaptive results

The adaptive runner doesn't produce standard `CrawlResult` pages. Instead it writes each
relevant page's content to `relevant.md` and stores a hand-built summary
(`index`, `url`, `success`, `score`, `markdown`, `artifacts`). Overall stats
(`confidence`, `pages_crawled`, `metrics`, `crawl_order`) go into `jobs.extra`.

---

## Artifact serving & safety

Artifacts are served by `GET /api/jobs/{id}/artifacts/{index}/{name}`. The handler resolves the
requested path and **rejects anything that escapes** the `artifacts/<job_id>/<index>/` base
(path-traversal guard) or isn't a real file (`404`). Media type is guessed from the extension;
`?download=1` forces an attachment download.

Deleting a job (`DELETE /api/jobs/{id}`) removes its `results` rows, its `jobs` row, and
`shutil.rmtree`s its artifact directory.

---

## Lifecycle & cleanup

- **In-memory** (`core/jobs.py`): running asyncio tasks, SSE subscriber queues, and a per-job
  event ring buffer (≤ 500 events, dropped 30s after the job ends). None of this survives a
  restart — but the DB and artifacts do, so finished jobs fully replay.
- **On restart**: running jobs are **not** resumed (there is no crash-recovery queue); their
  rows remain in whatever non-terminal state they were in. Completed/failed/cancelled jobs and
  all their results/artifacts persist and remain viewable and exportable.

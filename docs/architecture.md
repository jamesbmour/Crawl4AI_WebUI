# Architecture

Crawl4AI Studio is a two-process application: a **FastAPI backend** that drives the
`crawl4ai` library, and a **React SPA** that renders configuration forms and result views.
In development they run separately (Vite proxies `/api` to the backend). In production the
backend serves the pre-built frontend as static files, so everything is one process on one
port.

## High-level diagram

```
┌──────────────┐   HTTP (JSON)    ┌────────────────────────┐   Python API   ┌────────────┐
│   Browser    │ ───────────────► │      FastAPI backend    │ ─────────────► │  crawl4ai  │
│  React SPA   │ ◄─ SSE stream ── │  (app/main.py + routers)│ ◄───────────── │  library   │
└──────────────┘                  └───────────┬────────────┘                └─────┬──────┘
                                              │                                   │
                                   ┌──────────▼──────────┐            ┌───────────▼──────────┐
                                   │  SQLite (app.db)     │            │  Playwright browser  │
                                   │  jobs / results /    │            │  (chromium/ff/webkit)│
                                   │  schemas / profiles  │            └──────────────────────┘
                                   └──────────┬──────────┘
                                   ┌──────────▼──────────┐
                                   │ Filesystem artifacts │
                                   │ data/artifacts/…     │
                                   └─────────────────────┘
```

## Backend module map

All backend code lives under `backend/app/`.

```
backend/app/
├── main.py                 # FastAPI app, lifespan, CORS, router mounting, SPA static serving
├── api/                    # HTTP route handlers (thin — validate + delegate)
│   ├── crawl.py            # POST /crawl, /crawl/batch, /crawl/deep, /adaptive
│   ├── jobs_api.py         # GET/DELETE jobs, results, SSE stream, artifacts, export.zip
│   ├── seed.py             # POST /seed  (AsyncUrlSeeder)
│   ├── extraction.py       # POST /schema/generate  (LLM schema generation)
│   ├── ask.py              # POST /ask  (RAG Q&A via litellm)
│   ├── library.py          # CRUD for /schemas and /profiles
│   └── settings_api.py     # GET/PUT /settings, GET /meta
├── core/                   # Business logic
│   ├── mapping.py          # THE translation layer: JSON payload → crawl4ai config objects
│   ├── runners.py          # Per-job-type async runners that actually drive crawl4ai
│   ├── jobs.py             # In-process job manager + SSE event fan-out
│   ├── storage.py          # aiosqlite persistence (jobs/results/schemas/profiles)
│   ├── results.py          # Serialize CrawlResult → JSON + write artifacts to disk
│   ├── crawler_pool.py     # LRU pool of live AsyncWebCrawler instances
│   └── settings.py         # data-dir resolution, settings.json, LLMConfig builder
└── models/
    └── schemas.py          # Pydantic request/response models (mirror crawl4ai params)
```

### The mapping layer is the heart of the app

`core/mapping.py` is the single place where UI options meet the crawl4ai SDK. Every builder
function (`build_browser_config`, `build_crawler_config`, `build_deep_crawl_strategy`,
`build_dispatcher`, `build_seeding_config`, `build_adaptive_config`, `build_extraction_strategy`,
`build_markdown_generator`) only forwards values the client **explicitly set** — everything else
falls through to crawl4ai's own defaults. This keeps the Pydantic models (`models/schemas.py`)
almost entirely `Optional`, and lets the UI stay a thin, declarative mirror of the library.

A `MappingError` is raised for invalid combinations (e.g. a BM25 markdown filter with no query,
or LLM extraction with no provider configured). Crawl endpoints run the relevant builder
**eagerly at request time** (`_validate(...)`), so a bad config returns HTTP `422` immediately
instead of failing asynchronously inside a job.

## Job lifecycle

Crawls are asynchronous. A submit returns a `job_id` immediately; the client then subscribes to
an SSE stream for live progress and reads final results from the database.

```
1. POST /api/crawl (or /crawl/batch, /crawl/deep, /adaptive)
     └─ router validates config via mapping builders (422 on error)
     └─ jobs.start_job() creates a DB row (status="queued") and an asyncio task
     └─ returns { "job_id": "<12-hex>" }

2. GET /api/jobs/{id}/stream  (EventSource)
     └─ subscribes to the job's event queue; replays buffered events for late joiners

3. Task runs (core/runners.py):
     status → "running"
     runner drives crawl4ai (arun / arun_many / adaptive.digest)
     for each page/result:
        serialize_result() → writes artifacts + returns JSON summary
        storage.add_result() → persists + increments completed_urls
        publish("result", slim_summary) → fan-out to SSE subscribers

4. Terminal state:
     status → "completed" | "failed" | "cancelled"
     publish("status", …)   # SSE clients close on this
     event buffer dropped after a 30s grace period
```

### Job states

| Status | Meaning |
|--------|---------|
| `queued` | Row created, task not yet started |
| `running` | Runner is actively crawling |
| `completed` | Finished normally |
| `failed` | Runner raised; `error` column holds the message |
| `cancelled` | `POST /jobs/{id}/cancel` or `DELETE` cancelled the asyncio task |

### SSE event types

Events are JSON objects, one per `data:` line. Every event has `type` and `ts` (epoch seconds).

| `type` | Payload fields | Emitted when |
|--------|----------------|--------------|
| `status` | `status`, optional `error` | Job enters running / terminal state |
| `progress` | `message` | Human-readable milestone (e.g. "Crawling 12 URLs") |
| `result` | `result` (slim summary), optional `completed`, `total` | A page finishes |
| `adaptive_stats` | `stats` | Adaptive crawl completes (confidence, pages, metrics) |
| `error` | `message` | Stream-level error (e.g. job not found) |

The stream sends `: keepalive` comments every 25s of idleness so proxies don't drop the
connection, and sets `X-Accel-Buffering: no` to disable nginx buffering.

### Event buffering & replay

`core/jobs.py` keeps a per-job ring buffer of up to `EVENT_BUFFER_MAX = 500` events. A client
that connects mid-job replays the buffer first, then receives live events — so a page reload
never loses progress. For jobs that already finished (and whose buffer has expired), the stream
replays persisted results from SQLite and then a synthetic terminal `status` event.

## The crawler pool

`core/crawler_pool.py` maintains an LRU pool (`MAX_CRAWLERS = 3`) of live `AsyncWebCrawler`
instances, keyed by the canonical JSON of their `BrowserOptions`
(`browser_config_signature`). Crawls that share browser settings reuse a warm browser — which
also makes `session_id`-based multi-step flows work. Evicted crawlers are closed; all are
closed on app shutdown via the FastAPI `lifespan` hook.

## Persistence model

Three storage backends work together (see [data-model.md](data-model.md) for full detail):

- **SQLite (`data/app.db`)** — job metadata, per-URL result summaries, saved schemas, config
  profiles. Opened in **WAL** mode with a 5s busy timeout so result-writing during a long deep
  crawl doesn't block the job-list/detail reads.
- **Filesystem (`data/artifacts/<job_id>/<index>/`)** — large or binary artifacts: markdown,
  raw/cleaned HTML, screenshots, PDFs, MHTML, extracted JSON, network/console logs.
- **`data/settings.json`** — LLM provider config + default crawl config, written with mode
  `0600`.

The data directory is resolved at import time by `core/settings.py`: it honors
`C4AI_WEBUI_DATA` if set and writable, then falls back to repo-local `./data`, then to
`/tmp/c4ai-webui-data` for read-only container filesystems (e.g. Vercel serverless).

## Frontend architecture

```
frontend/src/
├── main.tsx                # React root
├── App.tsx                 # HashRouter + sidebar nav; declares all routes
├── lib/
│   ├── api.ts              # fetch wrapper, ApiError, streamJob() (EventSource), prune()
│   └── config.ts           # Declarative CONFIG_GROUPS — mirrors backend models 1:1
├── components/
│   ├── ConfigPanel.tsx     # Renders the shared config accordion from config.ts
│   ├── ExtractionEditor.tsx# CSS/XPath/regex/LLM extraction builder
│   ├── ResultTabs.tsx      # Tabbed result viewer (markdown, html, links, media, …)
│   ├── Field.tsx / shared.tsx  # Form primitives
│   ├── useCrawlConfig.ts   # Config state hook
│   └── useJob.ts           # Job submit + SSE subscription hook
└── pages/                  # One component per route (see user-guide.md)
```

Key patterns:

- **Config mirroring** — `lib/config.ts` declares each option group (`browser`, `page`,
  `content`, `markdown`, `capture`, `extraction`) as data, so the form UI is generated rather
  than hand-coded, and stays aligned with the backend Pydantic models.
- **Payload pruning** — `prune()` recursively strips `null`/`undefined`/`""`/empty
  arrays/objects before POSTing, so only values the user actually set are sent (matching the
  backend's "forward only what's set" philosophy).
- **Hash routing** — `HashRouter` means routes live after `#`, so the single `index.html`
  works when statically served without server-side route rewriting.

## Request flow example (single scrape)

```
User fills Scrape form
  → prune(config) drops empty fields
  → POST /api/crawl { url, config }
      → crawl.py: _resolve_schema(), _validate(build_crawler_config)  (422 on bad config)
      → jobs.start_job("scrape", …, make_single_crawl_runner)
      → { job_id }
  → UI opens EventSource /api/jobs/{id}/stream
      → status:running → progress:"Crawling …" → result:{…} → status:completed
  → UI GET /api/jobs/{id}/results?full=true  (full result for the tabbed viewer)
  → artifacts fetched lazily from /api/jobs/{id}/artifacts/{index}/{name}
```

<div align="center">

# Crawl4AI Studio

**A self-hosted web UI for [Crawl4AI](https://github.com/unclecode/crawl4ai)** — configure crawls through forms, watch them run live, and browse, re-run or export the results. Firecrawl-style playground, full library surface.

[![Python](https://img.shields.io/badge/python-3.11%2B-3776ab?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=black)](https://react.dev/)
[![Crawl4AI](https://img.shields.io/badge/Crawl4AI-0.7.x-ff6b35)](https://github.com/unclecode/crawl4ai)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[Quick Start](#quick-start) · [Features](#features) · [Configuration](#configuration) · [API](#api-reference) · [Docs](docs/README.md) · [Deploy](#deployment)

</div>

---

## Why Crawl4AI Studio

- **Visual configuration** — no Python needed; every `BrowserConfig` / `CrawlerRunConfig` option has a form field
- **Live progress** — Server-Sent Events stream crawl status as it happens
- **Persistent jobs** — results land in SQLite + filesystem; revisit, re-run, or export to ZIP
- **Reusable schemas** — save, version and reuse extraction schemas, plus crawl-settings presets
- **Optional LLM layer** — schema generation, smart filtering, and RAG Q&A over crawled content

## Features

### Crawling modes

| Mode | Endpoint | Use case |
|------|----------|----------|
| **Scrape** | `POST /api/crawl` | Single URL, full config surface — testing and one-off extraction |
| **Batch** | `POST /api/crawl/batch` | `arun_many()` with memory-adaptive or semaphore dispatching |
| **Deep crawl** | `POST /api/crawl/deep` | BFS / DFS / best-first recursive crawl with filters |
| **Discovery** | `POST /api/seed` | `AsyncUrlSeeder` — find URLs via sitemaps and Common Crawl |
| **Adaptive** | `POST /api/adaptive` | Information-foraging crawl that stops once it knows enough |

### Extraction and output

- **Extraction**: CSS/XPath schemas, 21 built-in regex patterns, LLM extraction, saved schema library
- **Formats**: markdown (raw + filtered), cleaned/raw HTML, links, media, tables, metadata (OG, Twitter, JSON-LD)
- **Capture**: screenshots (full page, viewport, element), PDF, MHTML, network and console logs, SSL cert details
- **Ask interface**: RAG-style Q&A over any page or finished job (`POST /api/ask`)
- **Library**: full-text search across every stored page, change detection against the previous crawl of a URL, and whole-job export as ZIP, Markdown, JSON Lines or CSV

### UI pages

`/` scrape · `/batch` · `/deep` · `/discovery` · `/extraction` · `/adaptive` · `/ask` · `/jobs` · `/search` · `/settings`

## Quick Start

```bash
git clone https://github.com/jamesbmour/crawl4ai_webui.git
cd crawl4ai_webui

./run.sh setup     # venv + crawl4ai + Playwright Chromium + npm packages
./run.sh dev       # backend :8742, UI http://localhost:5173
```

Open **http://localhost:5173**. For a single-process production build: `./run.sh prod` → http://127.0.0.1:8742.

### Prerequisites

- **Python** 3.11+
- **Node.js** 18+
- SQLite (bundled with Python) and the Playwright system libraries (`./run.sh setup` installs the browsers)

### Manual install

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
playwright install chromium

# Frontend
cd ../frontend
npm install
```

### Commands

| Task | `scripts/` (recommended) | Legacy |
|------|--------------------------|--------|
| One-time setup | `./scripts/setup.sh` | `./run.sh setup` |
| Dev servers (hot reload) | `./scripts/dev.sh` | `./run.sh dev` |
| Production | `./scripts/prod.sh` | `./run.sh prod` |
| Tests | `./scripts/test.sh` | `./run.sh test` |

Linux users also get double-click `.desktop` launchers in [`scripts/`](scripts/README.md).

**Dev**: FastAPI on `:8742` and Vite on `:5173` with the frontend proxying `/api`.
**Prod**: Vite builds to `frontend/dist/`, which the backend serves from a single port.

## Architecture

```
┌─────────────┐   HTTP / SSE   ┌──────────────┐   Python API   ┌────────────┐
│  Browser    │ ◄────────────► │   FastAPI    │ ◄────────────► │  Crawl4AI  │
│  (React)    │                │   backend    │                │  library   │
└─────────────┘                └──────┬───────┘                └────────────┘
                                      │
                                      ▼
                            SQLite + filesystem
                            (jobs, artifacts, settings)
```

**Job lifecycle**: `POST` a crawl config → get a `job_id` → open the SSE stream → backend runs the crawl and emits progress → results persist to SQLite (metadata) and `data/artifacts/` (binaries) → final result or error arrives over SSE.

**Persistence**

| Path | Contents |
|------|----------|
| `data/app.db` | Job metadata, configs, schemas, profiles |
| `data/artifacts/` | Screenshots, PDFs, MHTML, large payloads |
| `data/settings.json` | LLM provider config and API keys (mode `0600`) |

### Project layout

```
crawl4ai_webui/
├── backend/
│   ├── app/
│   │   ├── api/          # REST + SSE routers
│   │   ├── core/         # mapping.py, settings, storage, crawler pool
│   │   ├── models/       # Pydantic schemas
│   │   └── services/     # crawl execution and job management
│   ├── tests/            # unit + integration
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/   # shared UI
│       ├── lib/          # config definitions (mirrors backend models)
│       └── pages/        # one per route
├── data/                 # runtime state (gitignored)
├── docs/                 # authoritative technical reference
├── scripts/              # setup / dev / prod / test
├── run.sh                # legacy all-in-one entry point
├── Dockerfile            # container image
└── vercel.json           # serverless split (frontend + backend services)
```

## API Reference

Interactive docs at `/docs` (Swagger) and `/redoc` while the server runs. Full detail in [`docs/api-reference.md`](docs/api-reference.md).

**Crawls** — `POST /api/crawl`, `/api/crawl/batch`, `/api/crawl/deep`, `/api/adaptive`, `/api/seed`, `/api/ask`

**Jobs**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/jobs?limit=100` | List jobs (`running` flag included) |
| `GET` | `/api/jobs/{id}` | Job metadata |
| `GET` | `/api/jobs/{id}/results?full=true` | Result summaries or full payloads |
| `GET` | `/api/jobs/{id}/results/{index}` | Single result |
| `GET` | `/api/jobs/{id}/stream` | SSE progress stream |
| `POST` | `/api/jobs/{id}/cancel` | Cancel a running job |
| `DELETE` | `/api/jobs/{id}` | Delete a job |
| `GET` | `/api/jobs/{id}/artifacts/{index}/{name}` | Download an artifact |
| `GET` | `/api/jobs/{id}/export.zip` | Export the whole job |

**Library** — `GET`/`POST /api/schemas`, `GET`/`PUT`/`DELETE /api/schemas/{id}`, and the same set for `/api/profiles`

**Other** — `POST /api/schema/generate`, `GET`/`PUT /api/settings`, `GET /api/meta`, `GET /api/health`

## Configuration

Crawl behavior is configured per job through the UI, mapping 1:1 onto Crawl4AI objects in [`backend/app/core/mapping.py`](backend/app/core/mapping.py):

- **BrowserConfig** — browser type (chromium/firefox/webkit), headless, viewport, user agent, JS execution, proxy, cookies, headers, stealth, storage state
- **CrawlerRunConfig** — content filters, link filtering, screenshots, PDF/MHTML capture, timeouts, cache mode, dispatchers
- See [`docs/configuration.md`](docs/configuration.md) for every field

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `C4AI_WEBUI_DATA` | `./data` | Writable data directory (falls back to `/tmp/c4ai-webui-data`) |
| `PORT` | `8742` | Backend port (`run.sh`) |
| `CRAWL4_AI_BASE_DIRECTORY` | `~` | Crawl4AI's own cache/config home |

> The server binds to `127.0.0.1` by default.

## LLM Integration

Any [LiteLLM](https://docs.litellm.ai/)-compatible provider works: OpenAI, Anthropic, Google, Groq, Ollama, and custom endpoints.

Used for **schema generation** (describe the extraction in natural language), **smart filtering**, **natural-language extraction**, and **Ask** (RAG over crawled content).

Set the provider and API key in **Settings → LLM**. Keys are stored locally in `data/settings.json` with mode `0600`.

## Testing

```bash
./scripts/test.sh                        # whole suite
cd backend && .venv/bin/python -m pytest tests/unit -q         # mapping/utils
cd backend && .venv/bin/python -m pytest tests/integration -q  # API + DB
cd backend && .venv/bin/python -m pytest --cov=app --cov-report=html
```

## Deployment

**Docker**

```bash
docker build -t crawl4ai-studio .
docker run -p 8742:8742 -v c4ai_data:/data crawl4ai-studio
```

```yaml
services:
  crawl4ai:
    build: .
    ports: ["8742:8742"]
    volumes: [c4ai_data:/data]
    environment:
      - C4AI_WEBUI_DATA=/data
    restart: unless-stopped
volumes:
  c4ai_data:
```

**Vercel** — `vercel.json` splits the app into a static Vite frontend and a container backend (`backend/Dockerfile.vercel`). Serverless hosts cap request duration and have ephemeral storage, so job history resets per instance and long crawls may time out. Use a persistent host for real workloads.

**Reverse proxy** — point at `127.0.0.1:8742`, keep SSE unbuffered:

```nginx
location / {
    proxy_pass http://127.0.0.1:8742;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Connection '';
    proxy_buffering off;          # required for /api/jobs/{id}/stream
    proxy_read_timeout 3600s;
}
```

See [`docs/deployment.md`](docs/deployment.md) for the full matrix.

## Security

> **This app has no built-in authentication.** Do not expose it to untrusted networks without putting an authenticating proxy in front of it.

- Binds to `127.0.0.1` by default; no auth, no per-user isolation
- Crawled pages execute in a real headless browser — treat remote content as hostile
- `file://` URLs are reachable, so the process can read local files
- API keys sit in `data/settings.json` (mode `0600`) — protect the data directory
- Recommended: run in Docker or a VM, keep crawl4ai and Playwright patched, and restrict outbound network access

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Browser not found` | `backend/.venv/bin/playwright install chromium` |
| Port 8742 in use | `lsof -ti:8742 \| xargs kill -9` |
| `database is locked` | Only one backend instance may run per data dir; check permissions on `data/app.db` |
| OOM during batch crawls | Lower concurrency, enable memory-adaptive dispatching, add swap |
| SSE stream stalls behind a proxy | Disable proxy buffering (`proxy_buffering off`) |

Logs go to stdout/stderr. `C4AI_LOG_LEVEL=debug ./run.sh dev` raises verbosity.

More help: [Crawl4AI docs](https://docs.crawl4ai.com/) · [Crawl4AI issues](https://github.com/unclecode/crawl4ai/issues) · [project docs](docs/README.md)

## Contributing

1. Fork and branch: `git checkout -b feature/my-change`
2. Make the change — follow existing style (ESLint/Prettier frontend, Black/PEP 8 backend)
3. Add tests and update docs for API changes
4. `./scripts/test.sh` must pass
5. Commit (`feat: add ...`) and open a PR describing what changed, why, and how it was tested — screenshots for UI work

## Documentation

The root README is the overview; [`docs/`](docs/README.md) is the authoritative technical reference, generated from the source.

| Page | Contents |
|------|----------|
| [Architecture](docs/architecture.md) | System design, job lifecycle, crawler pool, SSE fan-out |
| [User Guide](docs/user-guide.md) | Every UI page and how to use it |
| [Configuration](docs/configuration.md) | All crawl options, dispatchers, deep crawl, seeding, adaptive |
| [API Reference](docs/api-reference.md) | REST + SSE shapes |
| [Data Model](docs/data-model.md) | SQLite schema, artifact layout, serialization |
| [LLM Integration](docs/llm-integration.md) | Providers, prompts, RAG |
| [Development](docs/development.md) | Local workflow and conventions |
| [Deployment](docs/deployment.md) | Docker, Vercel, reverse proxy, self-hosting |

## License

[MIT](LICENSE) © 2026 James

<div align="center"><sub>Built with <a href="https://github.com/unclecode/crawl4ai">Crawl4AI</a> · <a href="https://fastapi.tiangolo.com/">FastAPI</a> · <a href="https://react.dev/">React</a> · <a href="https://tailwindcss.com/">Tailwind CSS</a></sub></div>

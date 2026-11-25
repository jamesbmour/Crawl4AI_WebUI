# Crawl4AI Studio — Documentation

Detailed documentation for **Crawl4AI Studio**, a self-hosted web interface for the
[Crawl4AI](https://github.com/unclecode/crawl4ai) Python library. The app wraps the full
crawling / extraction feature surface of Crawl4AI in a visual playground: configure a crawl
through forms, run it, watch progress stream live, and browse/export the results.

> **Note:** The root [`README.md`](../README.md) is the marketing-style landing page.
> These `docs/` pages are the authoritative technical reference — where they disagree with
> the root README, trust `docs/` (it is generated from a read of the actual source).

## Documentation map

| Document | What it covers |
|----------|----------------|
| [architecture.md](architecture.md) | System design, request/job lifecycle, backend module map, the crawler pool, SSE fan-out |
| [user-guide.md](user-guide.md) | Every page in the UI, what it does, and how to use it |
| [configuration.md](configuration.md) | Every crawl config option (Browser / Page / Content / Markdown / Capture / Extraction), dispatchers, deep-crawl, seeding, adaptive |
| [api-reference.md](api-reference.md) | Complete REST + SSE API reference with request/response shapes |
| [data-model.md](data-model.md) | SQLite schema, artifact storage layout, result serialization |
| [llm-integration.md](llm-integration.md) | Configuring an LLM provider and the four LLM-powered features |
| [development.md](development.md) | Local setup, scripts, project layout, testing, coding conventions |
| [deployment.md](deployment.md) | Docker, Vercel, reverse-proxy, environment variables, security |

## The 30-second tour

```bash
git clone <repository-url> && cd crawl4ai_webui
bash ./run.sh setup     # venv + crawl4ai + Playwright chromium + npm deps
bash ./run.sh dev       # backend :8742, Vite UI :5173
```

Open **http://localhost:5173**.

## What the app can do

- **Scrape** — single-URL playground exposing every `BrowserConfig` / `CrawlerRunConfig` option.
- **Batch crawl** — `arun_many()` over a URL list with memory-adaptive or semaphore dispatch + rate limiting.
- **Deep crawl** — recursive BFS / DFS / Best-First crawling with filter chains and keyword scoring.
- **Discovery** — `AsyncUrlSeeder` URL discovery from sitemaps and/or Common Crawl, with optional BM25 relevance scoring.
- **Extraction studio** — build CSS/XPath schemas (hand-written or LLM-generated), regex, or LLM extraction, and save them to a reusable library.
- **Adaptive** — information-foraging crawl that stops once it has learned enough about a query.
- **Ask** — RAG-style Q&A chat over a finished job or an ad-hoc URL.
- **Jobs** — full history with live progress, stored artifacts, and ZIP export.
- **Settings** — LLM provider config and saved crawl-config profiles.

## Tech stack at a glance

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+, FastAPI, `uvicorn`, `aiosqlite`, `crawl4ai>=0.7.6` |
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, React Router (hash routing), CodeMirror, react-markdown |
| Persistence | SQLite (`app.db`, WAL mode) + filesystem artifact store + `settings.json` |
| Transport | JSON REST + Server-Sent Events (SSE) for live job progress |

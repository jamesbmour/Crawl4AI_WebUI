# Crawl4AI Studio

A self-hosted web interface for [Crawl4AI](https://github.com/unclecode/crawl4ai) — a Firecrawl-style playground
exposing the full feature surface of the library:

| Page | What it does |
| --- | --- |
| **Scrape** | Single-URL playground with every `BrowserConfig`/`CrawlerRunConfig` option — markdown (raw + filtered), cleaned/raw HTML, links, media, tables, metadata, screenshot, PDF, MHTML, network/console capture, SSL certificates |
| **Batch crawl** | `arun_many()` over a URL list with memory-adaptive or semaphore dispatching, rate limiting and live streaming results |
| **Deep crawl** | BFS / DFS / Best-First recursive crawling with URL-pattern, domain, content-type, relevance and SEO filters plus keyword scoring |
| **Discovery** | `AsyncUrlSeeder` — find URLs from sitemaps / Common Crawl with BM25 relevance scoring, then send them to batch crawl |
| **Extraction** | CSS/XPath schemas (generate once with an LLM, reuse forever), regex patterns (21 built-ins + custom), LLM extraction — with a saved-schema library |
| **Adaptive** | Information-foraging crawl that stops when it knows enough (statistical or embedding strategy) |
| **Ask** | Q&A chat over any crawled page or finished job |
| **Jobs** | Full history with stored artifacts, re-runnable payloads, ZIP export |
| **Settings** | Any LiteLLM provider (OpenAI, Anthropic, Gemini, Groq, Ollama…), config profiles |

## Quick start

```bash
./run.sh setup   # venv + crawl4ai + Playwright browsers + npm install
./run.sh dev     # backend on :8742, UI on http://localhost:5173
```

Production mode (single server, built frontend):

```bash
./run.sh prod    # http://127.0.0.1:8742
```

Docker:

```bash
docker build -t crawl4ai-webui .
docker run -p 8742:8742 -v c4ai_data:/data crawl4ai-webui
```

## Architecture

- **Backend** — FastAPI (`backend/app`). Every crawl is a job: the endpoint returns a `job_id` immediately and
  progress/results stream over SSE (`GET /api/jobs/{id}/stream`). Jobs, results, schemas and profiles persist in
  SQLite (`data/app.db`); large artifacts (markdown, HTML, screenshots, PDFs, MHTML) live in `data/artifacts/`.
  The translation from UI JSON to crawl4ai objects lives in `backend/app/core/mapping.py`.
- **Frontend** — React + Vite + TypeScript + Tailwind (`frontend/`). The config accordion is generated from
  declarative field definitions in `src/lib/config.ts`, mirroring the backend models 1:1.
- **LLM features** (LLM extraction/filtering, schema generation, Ask) use whatever LiteLLM provider you configure in
  Settings and degrade gracefully when none is set.

## Tests

```bash
./run.sh test    # mapping-layer unit tests + API smoke tests
```

## Security

This tool executes arbitrary JavaScript in a headless browser and can read local files via `file://` URLs.
It binds to **127.0.0.1** by default and has no authentication — do not expose it to untrusted networks.
LLM API keys are stored locally in `data/settings.json` (mode 0600).

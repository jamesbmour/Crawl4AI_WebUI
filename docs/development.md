# Development Guide

## Prerequisites

- **Python** 3.11+ (the Docker image uses 3.13)
- **Node.js** 18+
- A few hundred MB of disk for the Playwright Chromium download

## First-time setup

```bash
git clone <repository-url> && cd crawl4ai_webui
bash ./run.sh setup          # or: ./scripts/setup.sh
```

`setup` creates `backend/.venv`, installs `backend/requirements-dev.txt` (which pulls in
`requirements.txt` + test deps), installs Playwright's Chromium (via `crawl4ai-setup`, falling
back to `playwright install chromium`), and runs `npm install` in `frontend/`.

## Running

```bash
bash ./run.sh dev            # backend :8742 + Vite :5173 (hot reload both sides)
bash ./run.sh prod           # builds the frontend, backend serves everything on :8742
bash ./run.sh backend        # backend only (uvicorn), extra args forwarded
bash ./run.sh test           # pytest
```

Or the equivalent `scripts/` wrappers (`setup.sh`, `dev.sh`, `prod.sh`, `test.sh`), which add
coloured output, arg parsing, and env-var support. There are also `.desktop` launchers for
Linux desktops — see [`scripts/README.md`](../scripts/README.md).

| `run.sh` | `scripts/` | Does |
|----------|-----------|------|
| `setup` | `setup.sh` | Create venv, install deps + browsers |
| `dev` | `dev.sh` | Backend + Vite dev server, hot reload |
| `prod` | `prod.sh` | `npm run build` then serve from backend (`PORT`, `HOST`, `FORCE_REBUILD`) |
| `test` | `test.sh` | pytest (`--verbose`, `--coverage`) |

**Dev vs prod:** in dev, two processes run and Vite proxies `/api` → `127.0.0.1:8742`
(`vite.config.ts`). In prod, `frontend/dist` is built and `app/main.py` mounts it — `/assets`
statically and a catch-all SPA route returning `index.html` for everything else. One process,
one port.

## Ports & URLs

| URL | What |
|-----|------|
| http://localhost:5173 | Frontend (dev) |
| http://127.0.0.1:8742 | Backend API (dev) / whole app (prod) |
| http://127.0.0.1:8742/docs | Swagger UI |
| http://127.0.0.1:8742/redoc | ReDoc |
| http://127.0.0.1:8742/api/health | Liveness |

`PORT` overrides the backend port for `run.sh`.

## Project layout

```
crawl4ai_webui/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI app + SPA serving
│   │   ├── api/               route handlers (crawl, jobs_api, seed, extraction, ask, library, settings_api)
│   │   ├── core/              mapping, runners, jobs, storage, results, crawler_pool, settings
│   │   └── models/schemas.py  Pydantic request/response models
│   ├── tests/                 test_api.py, test_mapping.py, test_startup.py
│   ├── conftest.py            adds backend/ to sys.path
│   ├── pytest.ini             asyncio_mode=auto, testpaths=tests
│   ├── requirements.txt       runtime deps
│   ├── requirements-dev.txt   + pytest, pytest-asyncio, httpx
│   └── Dockerfile.vercel      Vercel container build
├── frontend/
│   ├── src/
│   │   ├── App.tsx            router + sidebar
│   │   ├── main.tsx           React root
│   │   ├── lib/               api.ts, config.ts
│   │   ├── components/        ConfigPanel, ExtractionEditor, ResultTabs, Field, shared, useCrawlConfig, useJob
│   │   └── pages/             one per route
│   ├── vite.config.ts         dev server + /api proxy
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json           dev / build / preview scripts
├── scripts/                   setup.sh, dev.sh, prod.sh, test.sh + .desktop launchers
├── run.sh                     all-in-one dev/prod script
├── Dockerfile                 single-image production build
├── vercel.json                Vercel service config
└── docs/                      ← this documentation
```

## Backend conventions

- **Thin routers, fat core.** `api/*` handlers validate input and delegate; the real work lives
  in `core/`. The pattern to know is `core/mapping.py` (JSON → crawl4ai objects) — see
  [architecture.md](architecture.md#the-mapping-layer-is-the-heart-of-the-app).
- **Models mirror crawl4ai.** `models/schemas.py` field names match `BrowserConfig` /
  `CrawlerRunConfig` params, and (almost) everything is `Optional`, so the mapping layer only
  forwards what's set.
- **Fail fast.** Crawl endpoints run mapping builders eagerly (`_validate`) so a bad config is a
  synchronous `422`, not a mysterious async job failure.
- **Lazy heavy imports.** `crawl4ai` and `litellm` are imported inside functions, keeping startup
  and the tests that don't need them fast.

## Frontend conventions

- **`lib/config.ts` is the single source for the config UI.** It declares `CONFIG_GROUPS` as
  data; `ConfigPanel.tsx` renders forms from it. Keep it aligned with `models/schemas.py` when
  adding options.
- **`prune()` before POST.** Strip empty values so payloads carry only what the user set.
- **`streamJob()`** wraps `EventSource` and auto-closes on a terminal `status` event.

## Testing

```bash
bash ./run.sh test                       # all tests, quiet
./scripts/test.sh --verbose              # detailed
./scripts/test.sh --coverage             # term + HTML coverage (backend/htmlcov/)
cd backend && .venv/bin/python -m pytest tests/test_mapping.py -q   # one file
```

`pytest.ini` sets `asyncio_mode=auto` (async tests need no decorator) and `testpaths=tests`.
`conftest.py` puts `backend/` on `sys.path`. Current suites:

- `test_mapping.py` — the JSON → crawl4ai translation layer (the highest-value tests).
- `test_api.py` — endpoint behaviour (uses `httpx`).
- `test_startup.py` — app import/boot sanity.

The frontend has no test runner configured; `npm run build` runs `tsc --noEmit` first, so type
errors fail the build.

## Making a change — checklist

1. Adding a crawl option? Add the field to the right `models/schemas.py` group, wire it in
   `core/mapping.py`, add it to `frontend/src/lib/config.ts`, and cover it in `test_mapping.py`.
2. Adding an endpoint? Create the handler in `api/`, include its router in `app/main.py`, and
   add an `api.ts` call on the frontend.
3. Run `bash ./run.sh test` and confirm `npm run build` type-checks.

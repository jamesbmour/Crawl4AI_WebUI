# Deployment & Operations

In production the backend serves the pre-built frontend, so the whole app is one process on one
port (default `8742`). Three deployment paths are supported out of the box.

## Docker (recommended)

The root [`Dockerfile`](../Dockerfile) is a multi-stage single-image build:

1. **`node:20-slim`** stage builds the frontend (`npm run build` → `frontend/dist`).
2. **`python:3.13-slim`** stage installs system libs for Chromium, the Python deps, and both
   Chromium builds (`chromium-headless-shell` and `chromium --no-shell`), then copies the
   backend and the built frontend in.

It sets `C4AI_WEBUI_DATA=/data`, declares `VOLUME /data`, exposes `8742`, and runs uvicorn on
`0.0.0.0:8742`.

```bash
docker build -t crawl4ai-studio .
docker run -p 8742:8742 -v c4ai_data:/data crawl4ai-studio
```

Persisting `/data` keeps your jobs, artifacts, saved schemas, profiles, and settings across
container restarts.

### docker-compose

```yaml
services:
  crawl4ai:
    build: .
    ports:
      - "8742:8742"
    volumes:
      - c4ai_data:/data
    environment:
      # Optional: provide an LLM key via env instead of storing it in settings.json
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    restart: unless-stopped

volumes:
  c4ai_data:
```

## Vercel

[`vercel.json`](../vercel.json) defines two services and routes `/api/*` to the backend
(container runtime, built from [`backend/Dockerfile.vercel`](../backend/Dockerfile.vercel)) and
everything else to the Vite frontend.

Caveats for serverless:

- Long-running crawls fit poorly in short-lived function invocations — the in-process job manager
  and SSE stream assume a persistent process. Deep/batch/adaptive jobs may be cut off.
- The container filesystem is read-only except `/tmp`; `core/settings.py` detects this and falls
  back to `/tmp/c4ai-webui-data`, so **persistence is ephemeral** — jobs and settings don't
  survive between cold starts.

Vercel is best for a demo of the single-URL Scrape flow, not durable multi-user use.

## Self-hosted behind a reverse proxy

Run the app (Docker or `bash ./run.sh prod`) bound locally, and terminate TLS / add auth at the
proxy. SSE needs a couple of proxy tweaks so progress streams aren't buffered.

```nginx
server {
    listen 80;
    server_name crawl4ai.example.com;

    location / {
        proxy_pass http://127.0.0.1:8742;
        proxy_http_version 1.1;
        proxy_set_header Host $host;

        # Server-Sent Events: don't buffer, don't time out mid-stream
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }
}
```

(The backend already sends `X-Accel-Buffering: no` on the SSE endpoint, which nginx honours.)

Add Basic Auth, OAuth2-proxy, or your gateway's auth in front — the app itself has **no
authentication** (see Security).

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `C4AI_WEBUI_DATA` | `./data` (repo) or `/tmp/c4ai-webui-data` | Data directory: `app.db`, `artifacts/`, `settings.json` |
| `PORT` | `8742` | Port `run.sh`/`scripts` bind uvicorn to |
| `HOST` | `127.0.0.1` | Bind address (`scripts/prod.sh`) |
| `FORCE_REBUILD` | `false` | `scripts/prod.sh`: rebuild the frontend even if `dist/` exists |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `GROQ_API_KEY` / `DEEPSEEK_API_KEY` | — | Provider key detected as a fallback so no token need be stored in `settings.json` |
| `PLAYWRIGHT_BROWSERS_PATH` | (image: `/ms-playwright`) | Where Playwright finds browsers |

> **CORS:** `app/main.py` allows origins `http://localhost:5173` and `http://127.0.0.1:5173`
> (the Vite dev server). In production the SPA is same-origin, so CORS isn't involved. If you
> serve the frontend from a different origin, add it to the `allow_origins` list.

## Security

The app is built as a **local, single-user playground**. Before exposing it, understand:

1. **No authentication** — anyone who can reach the port can submit crawls and read all results.
   Put it behind a reverse proxy with auth, and don't bind it to a public interface directly.
2. **Arbitrary JavaScript execution** — crawled pages run JS in a real headless browser; the
   `page.js_code` option runs your JS too. Treat crawled URLs as untrusted.
3. **`file://` and internal URLs** — the crawler can be pointed at local files and
   internal-network hosts (SSRF surface). Restrict egress if that matters.
4. **Stored API keys** — LLM tokens live in `data/settings.json` (mode `0600`). Protect the data
   directory; prefer env-var keys in shared environments.
5. **Isolation** — run in a container or VM so a hostile page can't reach your host.

### Operational tips

- **Persist the data directory** (`/data` volume) or you lose job history on restart.
- **Update regularly** — `crawl4ai` and Playwright ship fixes often.
- **Watch memory on batch/deep crawls** — prefer the memory-adaptive dispatcher and cap
  `max_pages` / concurrency. The crawler pool holds at most 3 live browsers.
- **Logs** go to stdout/stderr; job failures also persist to the `jobs.error` column and stream
  as an SSE `status:failed` event.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Browser not found" | Re-run setup, or `backend/.venv/bin/playwright install chromium` |
| Port already in use | `lsof -ti:8742 \| xargs kill -9`, or set `PORT` |
| "database is locked" | Ensure a single backend instance; WAL + 5s busy-timeout handle normal contention |
| No space left on device | Delete old jobs (removes their artifacts) or prune `data/artifacts/` |
| LLM feature returns 422 | Configure a provider in Settings, or export the provider's API-key env var |
| SSE stops / progress freezes behind a proxy | Disable proxy buffering for the stream (see nginx snippet) |
| Serverless job cut off | Expected on Vercel — use Docker/self-host for long crawls |

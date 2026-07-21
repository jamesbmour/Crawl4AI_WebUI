# Backend

FastAPI backend for Crawl4AI Studio — provides REST API and Server-Sent Events (SSE) for crawl job management.

## Tech Stack

- **Framework**: FastAPI
- **Server**: Uvicorn (with standard extras)
- **Crawl Engine**: crawl4ai (>=0.7.6,<0.8)
- **Data Validation**: Pydantic v2
- **Database**: SQLite (via aiosqlite for async support)
- **Python**: 3.11+

## Project Structure

```
app/
├── api/           # API routes and endpoints
├── core/          # Core utilities including mapping.py (UI JSON to crawl4ai objects)
├── models/        # Pydantic models and database schemas
├── services/      # Business logic and crawl services
└── main.py        # Application entry point

tests/             # Unit tests and API smoke tests
```

## Installation

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium
```

## Available Scripts

```bash
# From project root
../run.sh dev     # Start development server with auto-reload
../run.sh prod    # Start production server
../run.sh test    # Run tests (mapping-layer + API smoke tests)

# Direct usage
uvicorn app.main:app --reload --port 8742
```

## API Overview

Every crawl is a job:
- **Start Job**: `POST /api/jobs` — returns `job_id` immediately
- **Stream Progress**: `GET /api/jobs/{id}/stream` — SSE for real-time updates
- **Get Results**: `GET /api/jobs/{id}` — fetch completed job results

### Persistence

- **SQLite**: Jobs, results, schemas, and profiles stored in `data/app.db`
- **Artifacts**: Large files (markdown, HTML, screenshots, PDFs, MHTML) stored in `data/artifacts/`

## Key Modules

- **`app/core/mapping.py`**: Translates UI JSON configuration to crawl4ai `BrowserConfig`/`CrawlerRunConfig` objects
- **`app/services/`**: Contains crawl execution logic with memory-adaptive and semaphore dispatching

## Configuration

Settings (including LiteLLM provider API keys) are stored locally in `data/settings.json` with restricted permissions (0600).

## Security Notes

- Binds to **127.0.0.1** by default
- No built-in authentication — do not expose to untrusted networks
- Can execute JavaScript in headless browser and read local files via `file://` URLs

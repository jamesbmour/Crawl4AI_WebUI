# Crawl4AI Studio

A self-hosted web interface for [Crawl4AI](https://github.com/unclecode/crawl4ai) — a Firecrawl-style playground exposing the full feature surface of the library.

> 📚 **Detailed documentation** lives in [`docs/`](docs/README.md): [Architecture](docs/architecture.md) · [User Guide](docs/user-guide.md) · [Configuration](docs/configuration.md) · [API Reference](docs/api-reference.md) · [Data Model](docs/data-model.md) · [LLM Integration](docs/llm-integration.md) · [Development](docs/development.md) · [Deployment](docs/deployment.md). Those pages are generated from the actual source and are authoritative where they differ from this overview.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Development](#development)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [LLM Integration](#llm-integration)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

Crawl4AI Studio provides an intuitive web-based interface for the powerful Crawl4AI Python library. It transforms complex crawling operations into visual, configurable workflows suitable for both developers and non-technical users.

### Why Crawl4AI Studio?

- **Visual Configuration**: No need to write Python code — configure crawls through an interactive UI
- **Real-time Feedback**: Watch crawl progress live with Server-Sent Events (SSE)
- **Persistent Jobs**: All crawl results are saved and can be revisited, re-run, or exported
- **Schema Library**: Save and reuse extraction schemas across different crawls
- **LLM-Powered Features**: Optional AI integration for smart filtering, extraction, and Q&A

## Features

### Core Crawling Modes

| Page | Description | Use Case |
|------|-------------|----------|
| **Scrape** | Single-URL playground with every `BrowserConfig`/`CrawlerRunConfig` option | Testing configurations, one-off extractions |
| **Batch Crawl** | `arun_many()` over a URL list with memory-adaptive or semaphore dispatching | Bulk processing, data collection |
| **Deep Crawl** | BFS / DFS / Best-First recursive crawling with filters | Site mapping, comprehensive extraction |
| **Discovery** | `AsyncUrlSeeder` — find URLs from sitemaps / Common Crawl | URL discovery, seed generation |

### Data Extraction

| Feature | Description |
|---------|-------------|
| **CSS/XPath Schemas** | Define extraction patterns visually; generate with LLM, reuse forever |
| **Regex Patterns** | 21 built-in patterns plus custom regex support |
| **LLM Extraction** | Natural language extraction using configured LLM provider |
| **Schema Library** | Save, version, and manage extraction schemas |

### Output Formats

- Markdown (raw + filtered)
- Cleaned/raw HTML
- Links (internal/external with metadata)
- Media (images, videos, audio with dimensions/alt text)
- Tables (structured data extraction)
- Metadata (Open Graph, Twitter cards, JSON-LD)
- Screenshots (full page, viewport, element)
- PDF generation
- MHTML archives
- Network/console capture logs
- SSL certificate details

### Advanced Features

- **Adaptive Crawling**: Information-foraging crawl that stops when it knows enough (statistical or embedding strategy)
- **Ask Interface**: Q&A chat over any crawled page or finished job using RAG patterns
- **Job Management**: Full history with stored artifacts, re-runnable payloads, ZIP export
- **Settings Profiles**: Save and switch between different configuration presets
- **Rate Limiting**: Built-in respect for robots.txt with configurable delays

## Quick Start

```bash
# Clone and enter the repository
git clone <repository-url>
cd crawl4ai_webui

# One-time setup
bash ./run.sh setup   # Creates venv, installs crawl4ai, Playwright browsers, and npm packages

# Start development servers
bash ./run.sh dev     # Backend on :8742, UI on http://localhost:5173
```

Open your browser to `http://localhost:5173` to access the web interface.

## Installation

### Prerequisites

- **Python**: 3.11 or higher
- **Node.js**: 18.x or higher
- **System dependencies**:
  - Playwright dependencies (installed automatically via `run.sh setup`)
  - SQLite (usually included with Python)

### Manual Installation

If you prefer not to use the setup script:

```bash
# Backend setup
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium

# Frontend setup
cd ../frontend
npm install
```

### Development vs Production

**Development Mode**:
- Backend and frontend run as separate processes
- Hot reload enabled on both sides
- Frontend proxies API calls to backend

**Production Mode**:
- Backend serves built frontend static files
- Single server on port 8742
- Optimized builds with minification

## Development

### Project Structure

```
crawl4ai_webui/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # REST API endpoints
│   │   ├── core/           # Core utilities (mapping.py, etc.)
│   │   ├── models/         # Pydantic models and DB schemas
│   │   └── services/       # Business logic
│   ├── tests/              # Unit and integration tests
│   ├── requirements.txt    # Python dependencies
│   └── pytest.ini         # Test configuration
├── frontend/               # React + Vite frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── lib/           # Utilities and config definitions
│   │   ├── pages/         # Route pages
│   │   └── main.tsx       # Entry point
│   ├── package.json       # Node dependencies
│   └── tailwind.config.js # Tailwind configuration
├── data/                  # Runtime data (SQLite, artifacts)
├── scripts/              # Executable management scripts (setup, dev, prod, test)
├── run.sh                # Development and deployment scripts (legacy)
└── Dockerfile            # Container build instructions
```

### Available Commands

The project provides management scripts in two locations - use whichever you prefer:

**Via `scripts/` directory (recommended):**

| Command | Description |
|---------|-------------|
| `./scripts/setup.sh` | Initial environment setup |
| `./scripts/dev.sh` | Start development servers |
| `./scripts/prod.sh` | Start production server |
| `./scripts/test.sh` | Run test suite |

**Via legacy `run.sh`:**

| Command | Description |
|---------|-------------|
| `bash ./run.sh setup` | Initial environment setup |
| `bash ./run.sh dev` | Start development servers |
| `bash ./run.sh prod` | Start production server |
| `bash ./run.sh test` | Run test suite |
| `bash ./run.sh clean` | Clean build artifacts and dependencies |

> **Note:** The `scripts/` directory also includes desktop launchers (`.desktop` files) for Linux users. See `scripts/README.md` for details.

### Backend Development

The backend follows FastAPI conventions:

- **Entry Point**: `backend/app/main.py`
- **Auto-reload**: Enabled in development mode
- **API Documentation**: Available at `/docs` (Swagger UI) and `/redoc` (ReDoc) when server is running

Key backend modules:

- **`app/core/mapping.py`**: Translates UI JSON to crawl4ai objects
- **`app/services/crawl_service.py`**: Job execution and management
- **`app/api/jobs.py`**: Job endpoints with SSE streaming

### Frontend Development

The frontend uses React with TypeScript:

- **Entry Point**: `frontend/src/main.tsx`
- **Dev Server**: Vite on port 5173
- **Build Output**: `frontend/dist/` (served by backend in production)

Key frontend patterns:

- **Config Generation**: `src/lib/config.ts` mirrors backend models 1:1
- **State Management**: React hooks with context for global state
- **Styling**: Tailwind CSS with custom utility classes

## Architecture

### Data Flow

```
┌─────────────┐     HTTP/SSE      ┌──────────────┐     Python API      ┌──────────┐
│   Browser   │ ◄───────────────► │   FastAPI    │ ◄─────────────────► │ Crawl4AI │
│  (React)    │                   │   Backend    │                     │  Library │
└─────────────┘                   └──────────────┘                     └──────────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │    SQLite + FS      │
                              │  (jobs, artifacts)   │
                              └─────────────────────┘
```

### Job Lifecycle

1. **Submit**: Client POSTs crawl configuration → receives `job_id`
2. **Stream**: Client connects to SSE endpoint for real-time updates
3. **Execute**: Backend runs crawl with crawl4ai, streaming progress
4. **Store**: Results persisted to SQLite (metadata) and filesystem (artifacts)
5. **Complete**: Client receives final result or error via SSE

### Persistence Model

- **SQLite (`data/app.db`)**: Job metadata, configurations, schemas, settings
- **Filesystem (`data/artifacts/`)**: Large binary content (screenshots, PDFs, MHTML)
- **Settings (`data/settings.json`)**: User preferences, API keys (mode 0600)

## API Reference

### Core Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/jobs` | Create new crawl job |
| `GET` | `/api/jobs/{id}` | Get job details and results |
| `GET` | `/api/jobs/{id}/stream` | SSE stream for live progress |
| `DELETE` | `/api/jobs/{id}` | Cancel or delete job |
| `GET` | `/api/jobs` | List jobs with pagination |
| `POST` | `/api/jobs/{id}/rerun` | Re-run job with same config |

### Schemas

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/schemas` | List saved schemas |
| `POST` | `/api/schemas` | Save new schema |
| `GET` | `/api/schemas/{id}` | Get schema details |
| `PUT` | `/api/schemas/{id}` | Update schema |
| `DELETE` | `/api/schemas/{id}` | Delete schema |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/settings` | Get current settings |
| `POST` | `/api/settings` | Update settings |
| `GET` | `/api/settings/profiles` | List saved profiles |

## Configuration

### Crawl4AI Configuration

The UI exposes all Crawl4AI configuration options through generated forms:

**BrowserConfig**:
- Browser type (chromium, firefox, webkit)
- Headless mode toggle
- Viewport settings
- User agent
- JavaScript execution settings
- Proxy configuration

**CrawlerRunConfig**:
- Content extraction rules
- Link filtering patterns
- Screenshot options
- Timeout settings
- Cache behavior

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `C4AI_HOST` | `127.0.0.1` | Server bind address |
| `C4AI_PORT` | `8742` | Server port |
| `C4AI_DATA_DIR` | `./data` | Data storage path |
| `C4AI_LOG_LEVEL` | `info` | Logging verbosity |

## LLM Integration

Crawl4AI Studio supports multiple LLM providers via LiteLLM:

### Supported Providers

- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Google (Gemini)
- Groq
- Ollama (local models)
- Any LiteLLM-compatible endpoint

### LLM-Powered Features

1. **Schema Generation**: Describe what you want to extract in natural language; LLM generates CSS/XPath selectors
2. **Smart Filtering**: LLM-based content relevance scoring
3. **Extraction**: Natural language extraction prompts
4. **Ask Interface**: RAG-powered Q&A over crawled content

### Configuration

Set your API key in Settings → LLM Provider. The key is stored locally in `data/settings.json` with restricted permissions.

## Testing

```bash
# Run all tests
bash ./run.sh test

# Run specific test categories
pytest backend/tests/unit/        # Unit tests only
pytest backend/tests/integration/ # Integration tests only

# With coverage
pytest --cov=app --cov-report=html
```

### Test Structure

- **`tests/unit/`**: Mapping layer tests, utility function tests
- **`tests/integration/`**: API endpoint tests, database tests
- **`tests/fixtures/`**: Sample data and mock responses

## Deployment

### Docker

```bash
# Build image
docker build -t crawl4ai-webui .

# Run container
docker run -p 8742:8742 -v c4ai_data:/data crawl4ai-webui
```

Docker Compose example:

```yaml
version: '3.8'
services:
  crawl4ai:
    build: .
    ports:
      - "8742:8742"
    volumes:
      - c4ai_data:/data
    environment:
      - C4AI_LOG_LEVEL=info
    restart: unless-stopped

volumes:
  c4ai_data:
```

### Vercel

A `vercel.json` configuration is included for serverless deployment. Note: Serverless environments may have limitations with long-running crawl jobs.

### Self-Hosted

For production deployment behind a reverse proxy:

```nginx
# Nginx example
server {
    listen 80;
    server_name crawl4ai.example.com;
    
    location / {
        proxy_pass http://127.0.0.1:8742;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Security

⚠️ **Important Security Considerations**:

1. **Local Binding**: By default, the server binds to `127.0.0.1` only
2. **No Authentication**: No built-in user authentication — add reverse proxy auth for multi-user scenarios
3. **JavaScript Execution**: Can execute arbitrary JavaScript from crawled pages in headless browser
4. **File Access**: Can read local files via `file://` URLs
5. **API Keys**: Stored locally in `data/settings.json` with mode 0600

### Security Best Practices

- Do not expose to untrusted networks without additional authentication
- Run in isolated environment (Docker, VM)
- Regularly update crawl4ai and Playwright dependencies
- Review crawled URLs before execution

## Troubleshooting

### Common Issues

**"Browser not found" errors**:
```bash
playwright install chromium
```

**Port already in use**:
```bash
# Find and kill process using port 8742
lsof -ti:8742 | xargs kill -9
```

**Database locked errors**:
- Ensure only one backend instance is running
- Check file permissions on `data/app.db`

**Out of memory during batch crawls**:
- Reduce concurrent workers in settings
- Enable memory-adaptive dispatching
- Increase system swap space

### Logs

Backend logs are written to stdout/stderr. Increase verbosity:

```bash
C4AI_LOG_LEVEL=debug bash ./run.sh dev
```

### Getting Help

- Check the [Crawl4AI documentation](https://docs.crawl4ai.com/)
- Review [GitHub Issues](https://github.com/unclecode/crawl4ai/issues)
- Enable debug logging and capture output

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`bash ./run.sh test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines

- Follow existing code style (ESLint/Prettier for frontend, Black/PEP 8 for backend)
- Write tests for new features
- Update documentation for API changes
- Ensure `bash ./run.sh test` passes

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ using [Crawl4AI](https://github.com/unclecode/crawl4ai), [FastAPI](https://fastapi.tiangolo.com/), and [React](https://react.dev/).

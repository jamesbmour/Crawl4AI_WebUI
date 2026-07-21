# Scripts

This directory contains executable scripts for managing the Crawl4AI Studio application.

## Quick Start (Double-Click)

For Linux users with GNOME/KDE desktop environments, double-click these `.desktop` launchers:

| Launcher | Description |
|----------|-------------|
| `Crawl4AI-Setup.desktop` | Initial setup - run this first! |
| `Crawl4AI-Dev.desktop` | Start development servers |
| `Crawl4AI-Prod.desktop` | Start production server |

> **Note:** If `.desktop` files don't launch, right-click → "Allow Launching" (Ubuntu) or run `chmod +x scripts/*.desktop`

## Available Scripts

### `setup.sh`
Initial one-time setup script. Creates Python virtual environment, installs all dependencies, and sets up Playwright browsers.

```bash
./scripts/setup.sh
```

**What it does:**
- Creates Python virtual environment in `backend/.venv/`
- Installs backend Python dependencies
- Installs Playwright browsers (Chromium)
- Installs frontend npm packages

### `dev.sh`
Starts the application in development mode. Launches both backend and frontend servers with hot reload enabled.

```bash
./scripts/dev.sh
```

**What it does:**
- Starts FastAPI backend on `http://127.0.0.1:8742`
- Starts Vite frontend dev server on `http://localhost:5173`
- Enables auto-reload on both sides
- Press `Ctrl+C` to stop both servers

**Access URLs:**
- Frontend: http://localhost:5173
- Backend API: http://127.0.0.1:8742
- API Documentation: http://127.0.0.1:8742/docs

### `prod.sh`
Starts the application in production mode. Builds the frontend and serves it from the backend server.

```bash
./scripts/prod.sh
```

**What it does:**
- Builds the frontend for production (`npm run build`)
- Starts the backend server serving both API and static frontend files
- Runs on `http://127.0.0.1:8742` by default

**Environment Variables:**
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8742` | Server port |
| `HOST` | `127.0.0.1` | Bind address |
| `FORCE_REBUILD` | `false` | Set to `true` to force rebuild frontend |

```bash
# Example: Run on different port with forced rebuild
PORT=8080 FORCE_REBUILD=true ./scripts/prod.sh
```

### `test.sh`
Runs the test suite with optional coverage reporting.

```bash
./scripts/test.sh              # Run all tests
./scripts/test.sh --verbose    # Run with detailed output
./scripts/test.sh --coverage   # Run with coverage report
```

## Making Scripts Executable

On Linux/macOS, you may need to make the scripts executable:

```bash
chmod +x scripts/*.sh
```

## Legacy Script

The original `./run.sh` script in the project root is still functional and maps to these scripts:

| `run.sh` Command | Equivalent Script |
|------------------|-------------------|
| `./run.sh setup` | `./scripts/setup.sh` |
| `./run.sh dev` | `./scripts/dev.sh` |
| `./run.sh prod` | `./scripts/prod.sh` |
| `./run.sh test` | `./scripts/test.sh` |

## Troubleshooting

### "Permission denied" error
```bash
chmod +x scripts/*.sh
```

### "Virtual environment not found" error
Run setup first:
```bash
./scripts/setup.sh
```

### Port already in use
Find and kill the process:
```bash
lsof -ti:8742 | xargs kill -9
```

Or use a different port:
```bash
PORT=8080 ./scripts/dev.sh
```

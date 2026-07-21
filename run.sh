#!/usr/bin/env bash
# Crawl4AI Web UI — setup + run.
#   ./run.sh setup   install backend venv + browsers + frontend deps
#   ./run.sh dev     run backend (:8742) + Vite dev server (:5173)
#   ./run.sh prod    build frontend, serve everything from the backend (:8742)
set -euo pipefail
cd "$(dirname "$0")"

VENV="backend/.venv"
PY="$VENV/bin/python"
PORT="${PORT:-8742}"

setup() {
  if [ ! -x "$PY" ]; then
    echo "==> Creating venv"
    python3 -m venv "$VENV"
  fi
  echo "==> Installing backend deps"
  "$PY" -m pip install --upgrade pip -q
  "$PY" -m pip install -r backend/requirements-dev.txt -q
  echo "==> Installing Playwright browsers (crawl4ai-setup)"
  "$VENV/bin/crawl4ai-setup" || "$PY" -m playwright install chromium
  echo "==> Installing frontend deps"
  (cd frontend && npm install)
  echo "==> Done. Run: ./run.sh dev"
}

backend() {
  exec "$VENV/bin/uvicorn" app.main:app --app-dir backend --host 127.0.0.1 --port "$PORT" "$@"
}

case "${1:-dev}" in
  setup) setup ;;
  backend) shift; backend "$@" ;;
  dev)
    trap 'kill 0' EXIT
    "$VENV/bin/uvicorn" app.main:app --app-dir backend --host 127.0.0.1 --port "$PORT" &
    (cd frontend && npm run dev)
    ;;
  prod)
    (cd frontend && npm run build)
    backend
    ;;
  test)
    cd backend && exec ".venv/bin/python" -m pytest tests -q
    ;;
  *)
    echo "Usage: ./run.sh [setup|dev|prod|backend|test]" >&2
    exit 1
    ;;
esac

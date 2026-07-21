#!/usr/bin/env bash
# Crawl4AI Studio - Production Script
# Builds frontend and starts production server
# Server: http://127.0.0.1:8742

set -euo pipefail
cd "$(dirname "$0")/.."

VENV="backend/.venv"
PY="$VENV/bin/python"
PORT="${PORT:-8742}"
HOST="${HOST:-127.0.0.1}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if virtual environment exists
if [ ! -x "$PY" ]; then
    echo -e "${RED}Error: Virtual environment not found.${NC}"
    echo "Please run setup first:"
    echo "  ./scripts/setup.sh"
    exit 1
fi

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  Crawl4AI Studio - Production Mode${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# Check if frontend build exists or needs rebuild
if [ ! -d "frontend/dist" ] || [ "${FORCE_REBUILD:-false}" == "true" ]; then
    echo -e "${YELLOW}==> Building Frontend...${NC}"
    echo ""
    (cd frontend && npm run build)
    echo ""
    echo -e "${GREEN}✓ Frontend built successfully${NC}"
else
    echo -e "${YELLOW}==> Using existing frontend build (set FORCE_REBUILD=true to rebuild)${NC}"
fi

echo ""
echo -e "${YELLOW}==> Starting Production Server...${NC}"
echo "    URL: http://$HOST:$PORT"
echo ""

# Function to handle graceful shutdown
shutdown() {
    echo ""
    echo "Shutting down server..."
    kill %1 2>/dev/null || true
    wait 2>/dev/null || true
    echo "Done."
    exit 0
}
trap shutdown EXIT INT TERM

# Start production server
"$VENV/bin/uvicorn" app.main:app \
    --app-dir backend \
    --host "$HOST" \
    --port "$PORT" \
    --workers 1 \
    --log-level info &

SERVER_PID=$!

# Wait for server to start
sleep 2

# Check if server is running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${RED}Error: Server failed to start${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Production server running (PID: $SERVER_PID)${NC}"
echo ""
echo -e "${BLUE}==========================================${NC}"
echo -e "${GREEN}  Server is ready!${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""
echo "Access the application:"
echo "  - Web UI:   http://$HOST:$PORT"
echo "  - API Docs: http://$HOST:$PORT/docs"
echo "  - Health:   http://$HOST:$PORT/health"
echo ""
echo "Environment Variables:"
echo "  PORT=$PORT        (server port)"
echo "  HOST=$HOST        (bind address)"
echo "  FORCE_REBUILD=true (rebuild frontend on startup)"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Wait for server process
wait

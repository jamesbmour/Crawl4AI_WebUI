#!/usr/bin/env bash
# Crawl4AI Studio - Development Script
# Starts both backend and frontend in development mode
# Backend: http://127.0.0.1:8742
# Frontend: http://localhost:5173

set -euo pipefail
cd "$(dirname "$0")/.."

VENV="backend/.venv"
PY="$VENV/bin/python"
PORT="${PORT:-8742}"

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
echo -e "${BLUE}  Crawl4AI Studio - Development Mode${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill 0 2>/dev/null || true
    wait 2>/dev/null || true
    echo "Done."
}
trap cleanup EXIT INT TERM

# Start backend
echo -e "${YELLOW}==> Starting Backend Server...${NC}"
echo "    URL: http://127.0.0.1:$PORT"
echo "    API Docs: http://127.0.0.1:$PORT/docs"
echo ""

"$VENV/bin/uvicorn" app.main:app \
    --app-dir backend \
    --host 127.0.0.1 \
    --port "$PORT" \
    --reload \
    --log-level info &

BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}Error: Backend failed to start${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Backend server running (PID: $BACKEND_PID)${NC}"
echo ""

# Start frontend
echo -e "${YELLOW}==> Starting Frontend Development Server...${NC}"
echo "    URL: http://localhost:5173"
echo ""

(cd frontend && npm run dev) &

FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend server running (PID: $FRONTEND_PID)${NC}"

# Wait for frontend to start
sleep 2

echo ""
echo -e "${BLUE}==========================================${NC}"
echo -e "${GREEN}  All servers are running!${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""
echo "Access the application:"
echo "  - Frontend: http://localhost:5173"
echo "  - Backend:  http://127.0.0.1:$PORT"
echo "  - API Docs: http://127.0.0.1:$PORT/docs"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for both processes
wait

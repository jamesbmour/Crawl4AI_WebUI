#!/usr/bin/env bash
# Crawl4AI Studio - Setup Script
# Run this once to set up the development environment

set -euo pipefail
cd "$(dirname "$0")/.."

VENV="backend/.venv"
PY="$VENV/bin/python"

echo "=========================================="
echo "  Crawl4AI Studio - Setup"
echo "=========================================="
echo ""

# Check Python version
if ! python3 --version &>/dev/null; then
    echo "Error: Python 3 is not installed. Please install Python 3.11+ and try again."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "Python version: $PYTHON_VERSION"

# Create virtual environment
if [ ! -x "$PY" ]; then
    echo ""
    echo "==> Creating Python virtual environment..."
    python3 -m venv "$VENV"
    echo "✓ Virtual environment created"
else
    echo ""
    echo "==> Virtual environment already exists, skipping creation"
fi

# Install backend dependencies
echo ""
echo "==> Installing backend dependencies..."
"$PY" -m pip install --upgrade pip -q
"$PY" -m pip install -r backend/requirements-dev.txt -q
echo "✓ Backend dependencies installed"

# Install Playwright browsers
echo ""
echo "==> Installing Playwright browsers (this may take a minute)..."
if "$VENV/bin/crawl4ai-setup" 2>/dev/null; then
    echo "✓ Playwright browsers installed via crawl4ai-setup"
else
    "$PY" -m playwright install chromium
    echo "✓ Playwright browsers installed"
fi

# Install frontend dependencies
echo ""
echo "==> Installing frontend dependencies..."
(cd frontend && npm install)
echo "✓ Frontend dependencies installed"

echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Run: ./scripts/dev.sh     (to start development servers)"
echo "  2. Run: ./scripts/prod.sh    (to start production server)"
echo ""
echo "Or use the legacy run.sh:"
echo "  ./run.sh dev                 (development)"
echo "  ./run.sh prod                (production)"
echo ""

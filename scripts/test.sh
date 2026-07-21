#!/usr/bin/env bash
# Crawl4AI Studio - Test Script
# Runs the test suite

set -euo pipefail
cd "$(dirname "$0")/.."

VENV="backend/.venv"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if virtual environment exists
if [ ! -x "$VENV/bin/python" ]; then
    echo -e "${RED}Error: Virtual environment not found.${NC}"
    echo "Please run setup first:"
    echo "  ./scripts/setup.sh"
    exit 1
fi

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  Crawl4AI Studio - Running Tests${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# Parse arguments
TEST_ARGS=""
COVERAGE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --coverage|-c)
            COVERAGE=true
            shift
            ;;
        --verbose|-v)
            TEST_ARGS="$TEST_ARGS -v"
            shift
            ;;
        *)
            TEST_ARGS="$TEST_ARGS $1"
            shift
            ;;
    esac
done

# Run tests
cd backend

if [ "$COVERAGE" = true ]; then
    echo -e "${YELLOW}==> Running tests with coverage...${NC}"
    echo ""
    "$VENV/bin/python" -m pytest tests -q --cov=app --cov-report=term-missing --cov-report=html
    echo ""
    echo -e "${GREEN}✓ Coverage report generated in backend/htmlcov/${NC}"
    echo "   Open backend/htmlcov/index.html to view"
else
    echo -e "${YELLOW}==> Running tests...${NC}"
    echo ""
    "$VENV/bin/python" -m pytest tests -q $TEST_ARGS
fi

echo ""
echo -e "${GREEN}✓ Tests complete${NC}"
echo ""

# Show usage if no args provided and tests passed
if [ -z "$TEST_ARGS" ] && [ "$COVERAGE" = false ]; then
    echo "Usage:"
    echo "  ./scripts/test.sh              # Run all tests"
    echo "  ./scripts/test.sh --verbose  # Run with verbose output"
    echo "  ./scripts/test.sh --coverage  # Run with coverage report"
    echo ""
fi

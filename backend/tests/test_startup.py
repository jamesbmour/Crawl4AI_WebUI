"""Cold-start regression tests for the deployed FastAPI service."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def test_app_import_keeps_browser_stack_lazy(tmp_path: Path):
    """Lightweight API routes must listen before Crawl4AI/Playwright load."""
    backend_dir = Path(__file__).resolve().parents[1]
    env = os.environ.copy()
    env["C4AI_WEBUI_DATA"] = str(tmp_path / "data")
    env["CRAWL4_AI_BASE_DIRECTORY"] = str(tmp_path)
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "import sys; import app.main; "
                "print(any(name == 'crawl4ai' or name.startswith('crawl4ai.') "
                "for name in sys.modules)); "
                "print(any(name == 'playwright' or name.startswith('playwright.') "
                "for name in sys.modules))"
            ),
        ],
        cwd=backend_dir,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )

    assert result.stdout.splitlines() == ["False", "False"]


def test_vercel_image_installs_crawl4ai_chromium_binary():
    """Crawl4AI uses full Chromium in headless mode, not headless-shell."""
    backend_dir = Path(__file__).resolve().parents[1]
    dockerfile = (backend_dir / "Dockerfile.vercel").read_text()

    assert "playwright install chromium --no-shell" in dockerfile
    assert "playwright install chromium-headless-shell" not in dockerfile

"""Crawl4AI Web UI — FastAPI application."""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .api import ask, crawl, extraction, jobs_api, library, seed, settings_api
from .core import crawler_pool, storage
from .core.settings import ensure_dirs

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_dirs()
    await storage.get_db()
    yield
    await crawler_pool.close_all()
    await storage.close_db()


app = FastAPI(title="Crawl4AI Web UI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(crawl.router, prefix="/api")
app.include_router(jobs_api.router, prefix="/api")
app.include_router(seed.router, prefix="/api")
app.include_router(extraction.router, prefix="/api")
app.include_router(ask.router, prefix="/api")
app.include_router(library.router, prefix="/api")
app.include_router(settings_api.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"ok": True}


# Serve the built frontend (production mode). In dev, Vite serves the UI.
if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    async def spa(path: str):
        target = FRONTEND_DIST / path
        if path and target.is_file():
            return FileResponse(target)
        return FileResponse(FRONTEND_DIST / "index.html")

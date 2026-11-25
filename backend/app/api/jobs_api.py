"""Job listing, detail, SSE streaming, artifacts, cancel/delete, export."""
from __future__ import annotations

import asyncio
import csv
import difflib
import io
import json
import zipfile
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, Response, StreamingResponse

from ..core import jobs, storage
from ..core.settings import ARTIFACTS_DIR

router = APIRouter()


@router.get("/jobs")
async def list_jobs(limit: int = 100):
    rows = await storage.list_jobs(limit=limit)
    for row in rows:
        row["running"] = jobs.is_running(row["id"])
    return rows


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = await storage.get_job(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    job["running"] = jobs.is_running(job_id)
    return job


@router.get("/jobs/{job_id}/results")
async def get_job_results(job_id: str, full: bool = False):
    job = await storage.get_job(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    return await storage.get_results(job_id, full=full)


@router.get("/jobs/{job_id}/results/{index}")
async def get_job_result(job_id: str, index: int):
    summary = await storage.get_result(job_id, index)
    if summary is None:
        raise HTTPException(404, "Result not found")
    return summary


DIFF_MAX_LINES = 2000


def _markdown_diff(old: str, new: str) -> list[str]:
    diff = difflib.unified_diff(old.splitlines(), new.splitlines(), lineterm="", n=2)
    return list(diff)[2:]  # drop the ---/+++ file header


@router.get("/jobs/{job_id}/results/{index}/diff")
async def diff_job_result(job_id: str, index: int):
    """Compare a page's markdown with the previous crawl of the same URL."""
    current = await storage.get_result(job_id, index)
    if current is None:
        raise HTTPException(404, "Result not found")
    previous = await storage.get_previous_result(job_id, index)
    if previous is None:
        return {"previous": None}
    # difflib is CPU-bound and slow on large pages; keep it off the event loop.
    lines = await asyncio.to_thread(
        _markdown_diff, previous["summary"].get("markdown") or "", current.get("markdown") or ""
    )
    return {
        "previous": {k: previous[k] for k in ("job_id", "index", "created_at")},
        "added": sum(1 for line in lines if line.startswith("+")),
        "removed": sum(1 for line in lines if line.startswith("-")),
        "diff": lines[:DIFF_MAX_LINES],
        "truncated": len(lines) > DIFF_MAX_LINES,
    }


@router.get("/search")
async def search(q: str = Query(min_length=2, max_length=200), limit: int = Query(50, ge=1, le=200)):
    """Search every stored page by markdown content or URL."""
    return await storage.search_results(q.strip(), limit=limit)


@router.get("/jobs/{job_id}/stream")
async def stream_job(job_id: str):
    return StreamingResponse(
        jobs.sse_stream(job_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    if not await jobs.cancel_job(job_id):
        raise HTTPException(409, "Job is not running")
    return {"ok": True}


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    await jobs.cancel_job(job_id, wait=True)
    await storage.delete_job(job_id)
    return {"ok": True}


_MEDIA_TYPES = {
    ".png": "image/png",
    ".pdf": "application/pdf",
    ".md": "text/markdown; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".json": "application/json",
    ".mhtml": "message/rfc822",
}


def _safe_artifact_path(job_id: str, index: int, name: str) -> Path:
    base = (ARTIFACTS_DIR / job_id / str(index)).resolve()
    path = (base / name).resolve()
    if not str(path).startswith(str(base)) or not path.is_file():
        raise HTTPException(404, "Artifact not found")
    return path


@router.get("/jobs/{job_id}/artifacts/{index}/{name}")
async def get_artifact(job_id: str, index: int, name: str, download: bool = False):
    path = _safe_artifact_path(job_id, index, name)
    media_type = _MEDIA_TYPES.get(path.suffix, "application/octet-stream")
    headers = {}
    if download:
        headers["Content-Disposition"] = f'attachment; filename="{job_id}_{index}_{name}"'
    return FileResponse(path, media_type=media_type, headers=headers)


@router.get("/jobs/{job_id}/export.zip")
async def export_job(job_id: str):
    job = await storage.get_job(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    results = await storage.get_results(job_id, full=True)

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("job.json", json.dumps({k: v for k, v in job.items() if k != "running"}, indent=2, default=str))
        zf.writestr("results.json", json.dumps(results, indent=2, default=str))
        job_dir = ARTIFACTS_DIR / job_id
        if job_dir.is_dir():
            for path in sorted(job_dir.rglob("*")):
                if path.is_file():
                    zf.write(path, arcname=str(path.relative_to(job_dir)))
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="crawl_{job_id}.zip"'},
    )


def _csv_cell(value: Any) -> Any:
    """Crawled text must not run as a formula when the CSV opens in a spreadsheet."""
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + value
    return value


_EXPORT_TYPES = {
    "md": "text/markdown; charset=utf-8",
    "jsonl": "application/x-ndjson",
    "csv": "text/csv; charset=utf-8",
}
_CSV_FIELDS = ["index", "url", "success", "status_code", "depth", "score", "title", "markdown_length", "error_message"]


@router.get("/jobs/{job_id}/export.{fmt}")
async def export_job_as(job_id: str, fmt: Literal["md", "jsonl", "csv"]):
    """Whole job as one file: combined markdown, JSON lines, or a CSV page index."""
    if await storage.get_job(job_id) is None:
        raise HTTPException(404, "Job not found")
    results = await storage.get_results(job_id, full=True)
    for result in results:
        result["title"] = (result.get("metadata") or {}).get("title")

    if fmt == "md":
        body = "\n\n---\n\n".join(
            f"> Source: {r.get('url')}\n\n{r['markdown']}" for r in results if r.get("markdown")
        )
    elif fmt == "jsonl":
        keys = ("url", "title", "success", "status_code", "depth", "score", "markdown", "extracted_content", "metadata")
        body = "".join(json.dumps({k: r.get(k) for k in keys}, default=str) + "\n" for r in results)
    else:
        out = io.StringIO()
        writer = csv.DictWriter(out, fieldnames=_CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for r in results:
            r["markdown_length"] = len(r.get("markdown") or "")
            writer.writerow({k: _csv_cell(r.get(k)) for k in _CSV_FIELDS})
        body = out.getvalue()
    return Response(
        body,
        media_type=_EXPORT_TYPES[fmt],
        headers={"Content-Disposition": f'attachment; filename="crawl_{job_id}.{fmt}"'},
    )

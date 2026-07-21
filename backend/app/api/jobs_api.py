"""Job listing, detail, SSE streaming, artifacts, cancel/delete, export."""
from __future__ import annotations

import io
import zipfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse

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
    results = await storage.get_results(job_id, full=True)
    for summary in results:
        if summary.get("index") == index:
            return summary
    raise HTTPException(404, "Result not found")


@router.get("/jobs/{job_id}/stream")
async def stream_job(job_id: str):
    return StreamingResponse(
        jobs.sse_stream(job_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    if not jobs.cancel_job(job_id):
        raise HTTPException(409, "Job is not running")
    return {"ok": True}


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    if jobs.is_running(job_id):
        jobs.cancel_job(job_id)
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
        import json

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

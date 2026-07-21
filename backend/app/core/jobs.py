"""In-process job manager with SSE event fan-out.

Each job runs as an asyncio task. Progress events go to every subscribed SSE
client through per-subscriber queues; results and final status are persisted
via core/storage so completed jobs replay from the database.
"""
from __future__ import annotations

import asyncio
import json
import time
import traceback
from typing import Any, AsyncIterator, Awaitable, Callable, Optional

from . import storage

# job_id -> running task
_tasks: dict[str, asyncio.Task] = {}
# job_id -> list of subscriber queues
_subscribers: dict[str, list[asyncio.Queue]] = {}
# job_id -> buffered events (replayed to late subscribers of running jobs)
_event_buffer: dict[str, list[dict[str, Any]]] = {}
EVENT_BUFFER_MAX = 500

JobRunner = Callable[[str, Callable[[str, dict[str, Any]], Awaitable[None]]], Awaitable[None]]


async def publish(job_id: str, event_type: str, data: dict[str, Any]) -> None:
    event = {"type": event_type, "ts": time.time(), **data}
    buffer = _event_buffer.setdefault(job_id, [])
    buffer.append(event)
    if len(buffer) > EVENT_BUFFER_MAX:
        del buffer[: len(buffer) - EVENT_BUFFER_MAX]
    for queue in _subscribers.get(job_id, []):
        queue.put_nowait(event)


async def start_job(job_type: str, payload: dict[str, Any], runner: JobRunner, total_urls: int = 0) -> str:
    job_id = await storage.create_job(job_type, payload, total_urls=total_urls)

    async def _run() -> None:
        await storage.update_job(job_id, status="running", started_at=time.time())
        await publish(job_id, "status", {"status": "running"})
        try:
            await runner(job_id, publish)
        except asyncio.CancelledError:
            await storage.update_job(job_id, status="cancelled", finished_at=time.time())
            await publish(job_id, "status", {"status": "cancelled"})
            raise
        except Exception as exc:  # noqa: BLE001 — job errors must reach the client
            traceback.print_exc()
            await storage.update_job(
                job_id, status="failed", error=str(exc), finished_at=time.time()
            )
            await publish(job_id, "status", {"status": "failed", "error": str(exc)})
        else:
            await storage.update_job(job_id, status="completed", finished_at=time.time())
            await publish(job_id, "status", {"status": "completed"})
        finally:
            _tasks.pop(job_id, None)
            # Drop the event buffer after a grace period so late SSE
            # subscribers can still replay; runs outside this (possibly
            # cancelled) task so cleanup always happens.
            loop = asyncio.get_running_loop()
            loop.call_later(30, _event_buffer.pop, job_id, None)

    _tasks[job_id] = asyncio.create_task(_run())
    return job_id


def cancel_job(job_id: str) -> bool:
    task = _tasks.get(job_id)
    if task and not task.done():
        task.cancel()
        return True
    return False


def is_running(job_id: str) -> bool:
    task = _tasks.get(job_id)
    return task is not None and not task.done()


async def sse_stream(job_id: str) -> AsyncIterator[str]:
    """Yield SSE-formatted events for a job until it reaches a terminal state."""
    job = await storage.get_job(job_id)
    if job is None:
        yield _sse({"type": "error", "message": "job not found"})
        return

    terminal = {"completed", "failed", "cancelled"}

    if job["status"] in terminal and not _event_buffer.get(job_id):
        # Finished earlier — replay results from the database.
        for summary in await storage.get_results(job_id, full=False):
            yield _sse({"type": "result", "result": summary})
        yield _sse({"type": "status", "status": job["status"], "error": job.get("error")})
        return

    queue: asyncio.Queue = asyncio.Queue()
    _subscribers.setdefault(job_id, []).append(queue)
    try:
        # Replay anything that happened before this client connected.
        for event in list(_event_buffer.get(job_id, [])):
            yield _sse(event)
            if event.get("type") == "status" and event.get("status") in terminal:
                return
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=25)
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
                continue
            yield _sse(event)
            if event.get("type") == "status" and event.get("status") in terminal:
                return
    finally:
        subs = _subscribers.get(job_id, [])
        if queue in subs:
            subs.remove(queue)
        if not subs:
            _subscribers.pop(job_id, None)


def _sse(data: dict[str, Any]) -> str:
    return f"data: {json.dumps(data, default=str)}\n\n"

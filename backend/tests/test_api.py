"""API smoke tests using the ASGI transport (no browser launched)."""
import asyncio
import json
import os
import tempfile

import pytest

# Isolate test data before app modules import settings paths.
os.environ.setdefault("C4AI_WEBUI_DATA", tempfile.mkdtemp(prefix="c4ai_webui_test_"))

import httpx  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture
async def client():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as c:
        from app.core import storage

        await storage.get_db()
        yield c
        await storage.close_db()


@pytest.mark.asyncio
async def test_health(client):
    r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True


@pytest.mark.asyncio
async def test_meta(client):
    r = await client.get("/api/meta")
    assert r.status_code == 200
    body = r.json()
    assert "regex_builtin_patterns" in body
    assert "email" in body["regex_builtin_patterns"]


@pytest.mark.asyncio
async def test_settings_roundtrip(client):
    r = await client.get("/api/settings")
    assert r.status_code == 200
    r = await client.put("/api/settings", json={"llm_provider": "openai/gpt-4o-mini"})
    assert r.status_code == 200
    assert r.json()["llm_provider"] == "openai/gpt-4o-mini"


@pytest.mark.asyncio
async def test_default_crawl_config_roundtrip(client):
    config = {
        "browser": {"enable_stealth": True},
        "page": {"wait_until": "networkidle"},
        "capture": {"screenshot": True},
    }
    r = await client.put("/api/settings", json={"default_crawl_config": config})
    assert r.status_code == 200
    saved = r.json()["default_crawl_config"]
    assert saved["browser"]["enable_stealth"] is True
    assert saved["page"]["wait_until"] == "networkidle"
    assert saved["capture"]["screenshot"] is True

    r = await client.get("/api/settings")
    assert r.status_code == 200
    assert r.json()["default_crawl_config"] == saved


@pytest.mark.asyncio
async def test_schema_crud(client):
    payload = {
        "name": "products",
        "kind": "css",
        "payload": {"name": "p", "baseSelector": ".x", "fields": []},
    }
    r = await client.post("/api/schemas", json=payload)
    assert r.status_code == 200
    schema_id = r.json()["id"]

    r = await client.get("/api/schemas")
    assert any(s["id"] == schema_id for s in r.json())

    r = await client.get(f"/api/schemas/{schema_id}")
    assert r.json()["payload"]["baseSelector"] == ".x"

    r = await client.delete(f"/api/schemas/{schema_id}")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_profile_crud(client):
    payload = {
        "name": "stealth",
        "config": {"browser": {"enable_stealth": True}, "page": {"wait_until": "networkidle"}},
    }
    r = await client.post("/api/profiles", json=payload)
    assert r.status_code == 200
    pid = r.json()["id"]
    r = await client.get(f"/api/profiles/{pid}")
    assert r.json()["config"]["browser"]["enable_stealth"] is True
    r = await client.delete(f"/api/profiles/{pid}")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_crawl_validation_errors(client):
    # LLM extraction without a provider must 422 before creating a job.
    r = await client.post(
        "/api/crawl",
        json={"url": "https://example.com", "config": {"extraction": {"type": "css"}}},
    )
    assert r.status_code == 422

    r = await client.post("/api/crawl/batch", json={"urls": ["  "]})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_jobs_list(client):
    r = await client.get("/api/jobs")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_job_results_include_legacy_and_new_summaries(client):
    from app.core import storage

    job_id = await storage.create_job("batch", {})
    legacy = {"index": 0, "url": "https://example.test/legacy", "success": True, "markdown": "old"}
    new = {"index": 1, "url": "https://example.test/new", "success": True, "markdown": "new result"}
    db = await storage.get_db()
    await db.execute(
        "INSERT INTO results (job_id, idx, summary, created_at) VALUES (?, ?, ?, ?)",
        (job_id, 0, json.dumps(legacy), 0),
    )
    await db.commit()
    await storage.add_result(job_id, 1, new)

    path = f"/api/jobs/{job_id}/results"
    assert (await client.get(path)).json() == [storage.slim_summary(legacy), storage.slim_summary(new)]
    assert (await client.get(path, params={"full": "true"})).json() == [legacy, new]
    assert (await client.get(f"{path}/0")).json() == legacy
    assert (await client.get(f"{path}/1")).json() == new
    assert (await client.get(f"{path}/2")).status_code == 404


@pytest.mark.asyncio
async def test_cancel_running_job(client):
    from app.core import jobs, storage

    started = asyncio.Event()

    async def slow_runner(job_id, publish):
        started.set()
        await asyncio.Event().wait()

    job_id = await jobs.start_job("test", {}, slow_runner)
    await asyncio.wait_for(started.wait(), timeout=1)

    r = await client.post(f"/api/jobs/{job_id}/cancel")
    assert r.status_code == 200
    assert r.json() == {"ok": True}

    for _ in range(20):
        job = await storage.get_job(job_id)
        if job and job["status"] == "cancelled":
            break
        await asyncio.sleep(0.01)

    assert job["status"] == "cancelled"
    assert job["finished_at"] is not None


@pytest.mark.asyncio
async def test_cancel_while_job_is_starting(client, monkeypatch):
    from app.core import jobs, storage

    update_job = storage.update_job
    starting = asyncio.Event()

    async def pause_start(job_id, **fields):
        if fields.get("status") == "running":
            starting.set()
            await asyncio.Event().wait()
        await update_job(job_id, **fields)

    async def runner(job_id, publish):
        pytest.fail("A cancelled job should not reach its runner")

    monkeypatch.setattr(storage, "update_job", pause_start)
    job_id = await jobs.start_job("batch", {}, runner)
    await asyncio.wait_for(starting.wait(), timeout=2)
    assert (await client.post(f"/api/jobs/{job_id}/cancel")).status_code == 200
    stream = await asyncio.wait_for(client.get(f"/api/jobs/{job_id}/stream"), timeout=2)
    assert '"status": "cancelled"' in stream.text


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["memory_adaptive", "semaphore", "deep"])
async def test_cancel_crawl_stops_worker_and_keeps_result(client, monkeypatch, mode):
    from crawl4ai import CrawlResult
    from app.core import runners
    from app.core.crawl_streams import remember_crawl_page

    start_url = "https://example.test/start"
    slow_url = "https://example.test/slow"
    worker_started = asyncio.Event()
    worker_stopped = asyncio.Event()
    page_closed = asyncio.Event()

    class FixturePage:
        async def close(self):
            page_closed.set()

    class FixtureCrawler:
        async def arun(self, url, config, **kwargs):
            if url == slow_url:
                await remember_crawl_page(FixturePage(), config=config)
                worker_started.set()
                try:
                    await asyncio.Event().wait()
                finally:
                    worker_stopped.set()
            return CrawlResult(
                url=url,
                html="<p>Saved result</p>",
                success=True,
                links={"internal": [{"href": slow_url}]},
            )

    async def get_crawler(*args):
        return FixtureCrawler()

    monkeypatch.setattr(runners, "get_crawler", get_crawler)
    if mode == "deep":
        response = await client.post("/api/crawl/deep", json={"url": start_url, "max_depth": 1})
    else:
        response = await client.post(
            "/api/crawl/batch",
            json={"urls": [start_url, slow_url], "dispatcher": {"type": mode}},
        )
    assert response.status_code == 200
    path = f"/api/jobs/{response.json()['job_id']}"
    async with asyncio.timeout(3):
        await worker_started.wait()
        while not (await client.get(f"{path}/results")).json():
            await asyncio.sleep(0.01)
        assert (await client.post(f"{path}/cancel")).status_code == 200
        stream = await client.get(f"{path}/stream")

    assert '"status": "cancelled"' in stream.text
    assert worker_stopped.is_set()
    assert page_closed.is_set()
    assert (await client.get(path)).json()["completed_urls"] == 1
    assert [result["url"] for result in (await client.get(f"{path}/results")).json()] == [start_url]

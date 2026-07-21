"""API smoke tests using the ASGI transport (no browser launched)."""
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

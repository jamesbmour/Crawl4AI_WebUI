"""SQLite persistence for jobs, per-URL results, schemas and profiles."""
from __future__ import annotations

import json
import shutil
import time
import uuid
from typing import Any, Optional

import aiosqlite

from .settings import ARTIFACTS_DIR, DB_PATH, ensure_dirs

_SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    payload TEXT NOT NULL,
    error TEXT,
    created_at REAL NOT NULL,
    started_at REAL,
    finished_at REAL,
    total_urls INTEGER DEFAULT 0,
    completed_urls INTEGER DEFAULT 0,
    extra TEXT
);
CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    url TEXT,
    success INTEGER,
    summary TEXT NOT NULL,
    created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_results_job ON results(job_id);
CREATE TABLE IF NOT EXISTS schemas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    config TEXT NOT NULL,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);
"""

_db: Optional[aiosqlite.Connection] = None


async def get_db() -> aiosqlite.Connection:
    global _db
    if _db is None:
        ensure_dirs()
        _db = await aiosqlite.connect(DB_PATH)
        _db.row_factory = aiosqlite.Row
        # WAL lets readers (job list/detail polling) proceed while a deep
        # crawl is writing results; busy_timeout avoids "database is locked"
        # errors under the write-per-page churn of long-running jobs.
        await _db.execute("PRAGMA journal_mode=WAL")
        await _db.execute("PRAGMA busy_timeout=5000")
        await _db.execute("PRAGMA synchronous=NORMAL")
        await _db.executescript(_SCHEMA)
        await _db.commit()
    return _db


async def close_db() -> None:
    global _db
    if _db is not None:
        await _db.close()
        _db = None


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------

async def create_job(job_type: str, payload: dict[str, Any], total_urls: int = 0) -> str:
    db = await get_db()
    job_id = uuid.uuid4().hex[:12]
    await db.execute(
        "INSERT INTO jobs (id, type, status, payload, created_at, total_urls) VALUES (?,?,?,?,?,?)",
        (job_id, job_type, "queued", json.dumps(payload), time.time(), total_urls),
    )
    await db.commit()
    return job_id


async def update_job(job_id: str, **fields: Any) -> None:
    if not fields:
        return
    db = await get_db()
    cols = ", ".join(f"{k} = ?" for k in fields)
    await db.execute(f"UPDATE jobs SET {cols} WHERE id = ?", (*fields.values(), job_id))
    await db.commit()


async def get_job(job_id: str) -> Optional[dict[str, Any]]:
    db = await get_db()
    async with db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)) as cur:
        row = await cur.fetchone()
    return _job_row(row) if row else None


async def list_jobs(limit: int = 100) -> list[dict[str, Any]]:
    db = await get_db()
    async with db.execute(
        "SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?", (limit,)
    ) as cur:
        rows = await cur.fetchall()
    return [_job_row(r) for r in rows]


async def delete_job(job_id: str) -> None:
    db = await get_db()
    await db.execute("DELETE FROM results WHERE job_id = ?", (job_id,))
    await db.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
    await db.commit()
    shutil.rmtree(ARTIFACTS_DIR / job_id, ignore_errors=True)


def _job_row(row: aiosqlite.Row) -> dict[str, Any]:
    d = dict(row)
    d["payload"] = json.loads(d["payload"]) if d.get("payload") else {}
    if d.get("extra"):
        d["extra"] = json.loads(d["extra"])
    return d


# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------

async def add_result(job_id: str, index: int, summary: dict[str, Any]) -> None:
    db = await get_db()
    await db.execute(
        "INSERT INTO results (job_id, idx, url, success, summary, created_at) VALUES (?,?,?,?,?,?)",
        (
            job_id,
            index,
            summary.get("url"),
            1 if summary.get("success") else 0,
            json.dumps(summary, default=str),
            time.time(),
        ),
    )
    await db.execute(
        "UPDATE jobs SET completed_urls = completed_urls + 1 WHERE id = ?", (job_id,)
    )
    await db.commit()


async def get_results(job_id: str, full: bool = True) -> list[dict[str, Any]]:
    db = await get_db()
    async with db.execute(
        "SELECT summary FROM results WHERE job_id = ? ORDER BY idx", (job_id,)
    ) as cur:
        rows = await cur.fetchall()
    out = []
    for row in rows:
        summary = json.loads(row["summary"])
        if not full:
            summary = slim_summary(summary)
        out.append(summary)
    return out


def slim_summary(summary: dict[str, Any]) -> dict[str, Any]:
    """Lightweight view for job lists / streaming tables."""
    md = summary.get("markdown") or ""
    return {
        "index": summary.get("index"),
        "url": summary.get("url"),
        "success": summary.get("success"),
        "status_code": summary.get("status_code"),
        "error_message": summary.get("error_message"),
        "depth": summary.get("depth"),
        "score": summary.get("score"),
        "markdown_length": len(md),
        "artifacts": summary.get("artifacts", []),
    }


# ---------------------------------------------------------------------------
# Schemas library
# ---------------------------------------------------------------------------

async def create_schema(name: str, description: Optional[str], kind: str, payload: dict) -> int:
    db = await get_db()
    now = time.time()
    cur = await db.execute(
        "INSERT INTO schemas (name, description, kind, payload, created_at, updated_at) VALUES (?,?,?,?,?,?)",
        (name, description, kind, json.dumps(payload), now, now),
    )
    await db.commit()
    return cur.lastrowid


async def list_schemas() -> list[dict[str, Any]]:
    db = await get_db()
    async with db.execute("SELECT * FROM schemas ORDER BY updated_at DESC") as cur:
        rows = await cur.fetchall()
    return [_schema_row(r) for r in rows]


async def get_schema(schema_id: int) -> Optional[dict[str, Any]]:
    db = await get_db()
    async with db.execute("SELECT * FROM schemas WHERE id = ?", (schema_id,)) as cur:
        row = await cur.fetchone()
    return _schema_row(row) if row else None


async def update_schema(schema_id: int, name: str, description: Optional[str], kind: str, payload: dict) -> None:
    db = await get_db()
    await db.execute(
        "UPDATE schemas SET name=?, description=?, kind=?, payload=?, updated_at=? WHERE id=?",
        (name, description, kind, json.dumps(payload), time.time(), schema_id),
    )
    await db.commit()


async def delete_schema(schema_id: int) -> None:
    db = await get_db()
    await db.execute("DELETE FROM schemas WHERE id = ?", (schema_id,))
    await db.commit()


def _schema_row(row: aiosqlite.Row) -> dict[str, Any]:
    d = dict(row)
    d["payload"] = json.loads(d["payload"])
    return d


# ---------------------------------------------------------------------------
# Profiles
# ---------------------------------------------------------------------------

async def create_profile(name: str, description: Optional[str], config: dict) -> int:
    db = await get_db()
    now = time.time()
    cur = await db.execute(
        "INSERT INTO profiles (name, description, config, created_at, updated_at) VALUES (?,?,?,?,?)",
        (name, description, json.dumps(config), now, now),
    )
    await db.commit()
    return cur.lastrowid


async def list_profiles() -> list[dict[str, Any]]:
    db = await get_db()
    async with db.execute("SELECT * FROM profiles ORDER BY updated_at DESC") as cur:
        rows = await cur.fetchall()
    return [_profile_row(r) for r in rows]


async def get_profile(profile_id: int) -> Optional[dict[str, Any]]:
    db = await get_db()
    async with db.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)) as cur:
        row = await cur.fetchone()
    return _profile_row(row) if row else None


async def update_profile(profile_id: int, name: str, description: Optional[str], config: dict) -> None:
    db = await get_db()
    await db.execute(
        "UPDATE profiles SET name=?, description=?, config=?, updated_at=? WHERE id=?",
        (name, description, json.dumps(config), time.time(), profile_id),
    )
    await db.commit()


async def delete_profile(profile_id: int) -> None:
    db = await get_db()
    await db.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
    await db.commit()


def _profile_row(row: aiosqlite.Row) -> dict[str, Any]:
    d = dict(row)
    d["config"] = json.loads(d["config"])
    return d

"""URL discovery via AsyncUrlSeeder."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..core.mapping import build_seeding_config
from ..models.schemas import SeedRequest

router = APIRouter()


@router.post("/seed")
async def seed(req: SeedRequest):
    from crawl4ai import AsyncUrlSeeder

    domains = [d.strip() for d in req.domains if d.strip()]
    if not domains:
        raise HTTPException(422, "No domains provided")
    config = build_seeding_config(req)

    seeder = AsyncUrlSeeder()
    try:
        if hasattr(seeder, "__aenter__"):
            async with seeder:
                results = await _run_seeder(seeder, domains, config)
        else:
            results = await _run_seeder(seeder, domains, config)
    except Exception as exc:  # noqa: BLE001 — surface seeder errors to the client
        raise HTTPException(502, f"URL discovery failed: {exc}") from exc

    return {"domains": domains, "count": sum(len(v) for v in results.values()), "results": results}


async def _run_seeder(seeder, domains: list[str], config) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    if len(domains) > 1 and hasattr(seeder, "many_urls"):
        many = await seeder.many_urls(domains, config)
        for domain, urls in many.items():
            out[domain] = [_normalize_entry(u) for u in urls]
        return out
    for domain in domains:
        urls = await seeder.urls(domain, config)
        out[domain] = [_normalize_entry(u) for u in urls]
    return out


def _normalize_entry(entry) -> dict:
    if isinstance(entry, dict):
        head = entry.get("head_data") or {}
        return {
            "url": entry.get("url"),
            "status": entry.get("status"),
            "relevance_score": entry.get("relevance_score"),
            "title": (head.get("title") if isinstance(head, dict) else None),
        }
    return {"url": str(entry), "status": None, "relevance_score": None, "title": None}

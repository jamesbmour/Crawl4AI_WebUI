"""Crawl job endpoints: single, batch, deep, adaptive."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException

from ..core import jobs, storage
from ..core.mapping import MappingError
from ..core.runners import (
    make_adaptive_runner,
    make_batch_crawl_runner,
    make_deep_crawl_runner,
    make_single_crawl_runner,
)
from ..models.schemas import (
    AdaptiveRequest,
    BatchCrawlRequest,
    CrawlConfigPayload,
    CrawlRequest,
    DeepCrawlRequest,
)

router = APIRouter()


async def _resolve_schema(config: CrawlConfigPayload) -> Optional[dict[str, Any]]:
    schema_id = config.extraction.schema_id
    if schema_id is None:
        return None
    saved = await storage.get_schema(schema_id)
    if saved is None:
        raise HTTPException(404, f"Saved schema {schema_id} not found")
    return saved["payload"]


def _validate(fn, *args, **kwargs):
    """Run a mapping build eagerly so config errors return 422 instead of failing the job."""
    try:
        return fn(*args, **kwargs)
    except MappingError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/crawl")
async def start_crawl(req: CrawlRequest) -> dict[str, str]:
    from ..core.mapping import build_crawler_config
    from ..core.settings import get_llm_config

    resolved = await _resolve_schema(req.config)
    _validate(build_crawler_config, req.config, get_llm_config(), resolved)
    job_id = await jobs.start_job(
        "scrape", req.model_dump(mode="json"), make_single_crawl_runner(req, resolved), total_urls=1
    )
    return {"job_id": job_id}


@router.post("/crawl/batch")
async def start_batch(req: BatchCrawlRequest) -> dict[str, str]:
    from ..core.mapping import build_crawler_config, build_dispatcher
    from ..core.settings import get_llm_config

    urls = [u.strip() for u in req.urls if u.strip()]
    if not urls:
        raise HTTPException(422, "No URLs provided")
    req.urls = urls
    resolved = await _resolve_schema(req.config)
    _validate(build_crawler_config, req.config, get_llm_config(), resolved)
    _validate(build_dispatcher, req.dispatcher)
    job_id = await jobs.start_job(
        "batch", req.model_dump(mode="json"), make_batch_crawl_runner(req, resolved), total_urls=len(urls)
    )
    return {"job_id": job_id}


@router.post("/crawl/deep")
async def start_deep(req: DeepCrawlRequest) -> dict[str, str]:
    from ..core.mapping import build_crawler_config, build_deep_crawl_strategy
    from ..core.settings import get_llm_config

    resolved = await _resolve_schema(req.config)
    _validate(build_deep_crawl_strategy, req)
    _validate(build_crawler_config, req.config, get_llm_config(), resolved)
    job_id = await jobs.start_job(
        "deep", req.model_dump(mode="json"), make_deep_crawl_runner(req, resolved)
    )
    return {"job_id": job_id}


@router.post("/adaptive")
async def start_adaptive(req: AdaptiveRequest) -> dict[str, str]:
    from ..core.mapping import build_adaptive_config

    _validate(build_adaptive_config, req)
    job_id = await jobs.start_job(
        "adaptive", req.model_dump(mode="json"), make_adaptive_runner(req)
    )
    return {"job_id": job_id}

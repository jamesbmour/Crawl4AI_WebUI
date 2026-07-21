"""Schema generation (one-shot LLM) endpoint."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException

from ..core.crawler_pool import get_crawler
from ..core.settings import get_llm_config
from ..models.schemas import SchemaGenerateRequest

router = APIRouter()

MAX_SCHEMA_HTML = 120_000


@router.post("/schema/generate")
async def generate_schema(req: SchemaGenerateRequest):
    from crawl4ai import CacheMode, CrawlerRunConfig, JsonElementExtractionStrategy

    llm = get_llm_config()
    if llm is None:
        raise HTTPException(422, "Schema generation requires an LLM provider — configure one in Settings")

    html = req.html
    if not html:
        if not req.url:
            raise HTTPException(422, "Provide a url or html")
        crawler = await get_crawler()
        result = await crawler.arun(
            req.url, config=CrawlerRunConfig(cache_mode=CacheMode.ENABLED, verbose=False)
        )
        if not result.success:
            raise HTTPException(502, f"Failed to fetch {req.url}: {result.error_message}")
        html = result.cleaned_html or result.html

    if len(html) > MAX_SCHEMA_HTML:
        html = html[:MAX_SCHEMA_HTML]

    def _generate():
        return JsonElementExtractionStrategy.generate_schema(
            html=html,
            schema_type=req.schema_type,
            query=req.query,
            target_json_example=req.target_json_example,
            llm_config=llm,
        )

    try:
        schema = await asyncio.to_thread(_generate)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Schema generation failed: {exc}") from exc
    return {"schema": schema}

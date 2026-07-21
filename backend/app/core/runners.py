"""Job runner factories — the code that actually drives crawl4ai per job type."""
from __future__ import annotations

import json
from typing import Any, Awaitable, Callable, Optional

from ..models.schemas import (
    AdaptiveRequest,
    BatchCrawlRequest,
    CrawlRequest,
    DeepCrawlRequest,
)
from . import storage
from .crawler_pool import get_crawler
from .mapping import (
    build_adaptive_config,
    build_crawler_config,
    build_deep_crawl_strategy,
    build_dispatcher,
)
from .results import artifact_dir, serialize_result
from .settings import get_llm_config

Publish = Callable[..., Awaitable[None]]


def make_single_crawl_runner(req: CrawlRequest, resolved_schema: Optional[dict] = None):
    async def runner(job_id: str, publish: Publish) -> None:
        llm = get_llm_config()
        config = build_crawler_config(req.config, llm, resolved_schema)
        crawler = await get_crawler(req.config.browser)
        await publish(job_id, "progress", {"message": f"Crawling {req.url}"})
        result = await crawler.arun(req.url, config=config)
        summary = serialize_result(result, job_id, 0)
        await storage.add_result(job_id, 0, summary)
        await publish(job_id, "result", {"result": storage.slim_summary(summary)})
        if not summary["success"]:
            raise RuntimeError(summary.get("error_message") or "Crawl failed")

    return runner


def make_batch_crawl_runner(req: BatchCrawlRequest, resolved_schema: Optional[dict] = None):
    async def runner(job_id: str, publish: Publish) -> None:
        llm = get_llm_config()
        config = build_crawler_config(req.config, llm, resolved_schema, stream=True)
        dispatcher = build_dispatcher(req.dispatcher)
        crawler = await get_crawler(req.config.browser)
        await publish(
            job_id, "progress", {"message": f"Crawling {len(req.urls)} URLs"}
        )
        index = 0
        failures = 0
        async for result in await crawler.arun_many(
            req.urls, config=config, dispatcher=dispatcher
        ):
            summary = serialize_result(result, job_id, index)
            await storage.add_result(job_id, index, summary)
            await publish(
                job_id,
                "result",
                {"result": storage.slim_summary(summary), "completed": index + 1, "total": len(req.urls)},
            )
            if not summary["success"]:
                failures += 1
            index += 1
        if failures == len(req.urls) and req.urls:
            raise RuntimeError("All URLs failed to crawl")

    return runner


def make_deep_crawl_runner(req: DeepCrawlRequest, resolved_schema: Optional[dict] = None):
    async def runner(job_id: str, publish: Publish) -> None:
        llm = get_llm_config()
        strategy = build_deep_crawl_strategy(req)
        config = build_crawler_config(
            req.config, llm, resolved_schema, stream=True, deep_crawl_strategy=strategy
        )
        crawler = await get_crawler(req.config.browser)
        await publish(
            job_id,
            "progress",
            {"message": f"Deep crawl ({req.strategy}) from {req.url}, depth ≤ {req.max_depth}"},
        )
        index = 0
        async for result in await crawler.arun(req.url, config=config):
            summary = serialize_result(result, job_id, index)
            await storage.add_result(job_id, index, summary)
            await publish(job_id, "result", {"result": storage.slim_summary(summary), "completed": index + 1})
            index += 1
        if index == 0:
            raise RuntimeError("Deep crawl produced no pages")

    return runner


def make_adaptive_runner(req: AdaptiveRequest):
    async def runner(job_id: str, publish: Publish) -> None:
        from crawl4ai import AdaptiveCrawler

        config = build_adaptive_config(req)
        crawler = await get_crawler()
        adaptive = AdaptiveCrawler(crawler=crawler, config=config)
        await publish(
            job_id,
            "progress",
            {"message": f"Adaptive crawl from {req.start_url} for query: {req.query!r}"},
        )
        state = await adaptive.digest(start_url=req.start_url, query=req.query)

        confidence = None
        for attr in ("confidence",):
            value = getattr(adaptive, attr, None)
            if isinstance(value, (int, float)):
                confidence = float(value)
        metrics = dict(getattr(state, "metrics", {}) or {})

        relevant: list[dict[str, Any]] = []
        try:
            relevant = adaptive.get_relevant_content(top_k=min(req.max_pages, 20)) or []
        except Exception:
            pass

        index = 0
        for item in relevant:
            url = item.get("url") if isinstance(item, dict) else None
            content = (item.get("content") if isinstance(item, dict) else None) or ""
            score = item.get("score") if isinstance(item, dict) else None
            name = "relevant.md"
            (artifact_dir(job_id, index) / name).write_text(content, encoding="utf-8")
            summary = {
                "index": index,
                "url": url,
                "success": True,
                "score": score,
                "markdown": content,
                "artifacts": [name],
            }
            await storage.add_result(job_id, index, summary)
            await publish(job_id, "result", {"result": storage.slim_summary(summary)})
            index += 1

        stats = {
            "confidence": confidence,
            "pages_crawled": len(getattr(state, "crawled_urls", []) or []),
            "metrics": json.loads(json.dumps(metrics, default=str)),
            "crawl_order": list(getattr(state, "crawl_order", []) or []),
        }
        await storage.update_job(job_id, extra=json.dumps(stats, default=str))
        await publish(job_id, "adaptive_stats", {"stats": stats})

    return runner

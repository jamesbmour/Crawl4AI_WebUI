"""Q&A over crawled content using the configured LLM (via litellm)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..core import storage
from ..core.crawler_pool import get_crawler
from ..core.settings import get_llm_config
from ..models.schemas import AskRequest

router = APIRouter()

MAX_CONTEXT_CHARS = 120_000


@router.post("/ask")
async def ask(req: AskRequest):
    llm = get_llm_config()
    if llm is None:
        raise HTTPException(422, "Ask requires an LLM provider — configure one in Settings")

    context, source = await _load_context(req)
    if not context:
        raise HTTPException(422, "No content found — provide a job_id with results or a url")

    system = (
        "You are a helpful assistant answering questions about web page content. "
        "Use ONLY the provided page content to answer. If the answer is not in the "
        "content, say so. Cite the source URL when helpful.\n\n"
        f"=== PAGE CONTENT ({source}) ===\n{context[:MAX_CONTEXT_CHARS]}"
    )
    messages = [{"role": "system", "content": system}]
    for turn in req.history[-10:]:
        role = turn.get("role")
        content = turn.get("content")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": req.question})

    try:
        import litellm

        kwargs = {"model": llm.provider, "messages": messages}
        if llm.api_token:
            kwargs["api_key"] = llm.api_token
        if llm.base_url:
            kwargs["base_url"] = llm.base_url
        response = await litellm.acompletion(**kwargs)
        answer = response.choices[0].message.content
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"LLM call failed: {exc}") from exc

    return {"answer": answer, "source": source}


async def _load_context(req: AskRequest) -> tuple[str, str]:
    if req.job_id:
        results = await storage.get_results(req.job_id, full=True)
        parts = []
        for summary in results:
            md = summary.get("fit_markdown") or summary.get("markdown")
            if md:
                parts.append(f"## {summary.get('url')}\n\n{md}")
            if len("\n\n".join(parts)) > MAX_CONTEXT_CHARS:
                break
        return "\n\n".join(parts), f"job {req.job_id}"

    if req.url:
        from crawl4ai import CacheMode, CrawlerRunConfig

        crawler = await get_crawler()
        result = await crawler.arun(
            req.url, config=CrawlerRunConfig(cache_mode=CacheMode.ENABLED, verbose=False)
        )
        if not result.success:
            raise HTTPException(502, f"Failed to fetch {req.url}: {result.error_message}")
        md = result.markdown.raw_markdown if result.markdown else ""
        return md, req.url

    return "", ""

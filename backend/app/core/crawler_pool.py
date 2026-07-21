"""Shared AsyncWebCrawler pool.

Crawlers are keyed by the canonical JSON of their BrowserOptions so that
repeat crawls (and session_id-based flows) reuse a live browser. A small LRU
cap keeps memory bounded; evicted crawlers are closed.
"""
from __future__ import annotations

import asyncio
from collections import OrderedDict
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from crawl4ai import AsyncWebCrawler

from ..models.schemas import BrowserOptions
from .mapping import browser_config_signature, build_browser_config

MAX_CRAWLERS = 3

_pool: "OrderedDict[str, AsyncWebCrawler]" = OrderedDict()
_lock = asyncio.Lock()


async def get_crawler(opts: Optional[BrowserOptions] = None) -> AsyncWebCrawler:
    from crawl4ai import AsyncWebCrawler

    opts = opts or BrowserOptions()
    key = browser_config_signature(opts)
    async with _lock:
        if key in _pool:
            _pool.move_to_end(key)
            return _pool[key]

        crawler = AsyncWebCrawler(config=build_browser_config(opts))
        await crawler.start()
        _pool[key] = crawler

        while len(_pool) > MAX_CRAWLERS:
            _, old = _pool.popitem(last=False)
            try:
                await old.close()
            except Exception:
                pass
        return crawler


async def close_all() -> None:
    async with _lock:
        for crawler in _pool.values():
            try:
                await crawler.close()
            except Exception:
                pass
        _pool.clear()

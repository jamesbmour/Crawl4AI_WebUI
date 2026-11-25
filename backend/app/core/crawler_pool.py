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

    from .crawl_streams import remember_crawl_page

    opts = opts or BrowserOptions()
    key = browser_config_signature(opts)
    async with _lock:
        if key in _pool:
            _pool.move_to_end(key)
            return _pool[key]

        config = build_browser_config(opts)
        crawler = AsyncWebCrawler(config=config)
        if not config.use_managed_browser:
            crawler.crawler_strategy.set_hook("on_page_context_created", remember_crawl_page)
        try:
            await crawler.start()
        except asyncio.CancelledError:
            # A stop during browser startup must not leave an unpooled browser.
            try:
                await crawler.close()
            except Exception:
                pass
            raise
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

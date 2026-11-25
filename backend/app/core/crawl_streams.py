"""Keep Crawl4AI 0.7.x streaming dispatch tasks scoped to their crawl."""
from __future__ import annotations

import asyncio
import uuid
from contextlib import aclosing
from contextvars import ContextVar
from typing import TYPE_CHECKING

from crawl4ai import MemoryAdaptiveDispatcher, RateLimiter, SemaphoreDispatcher

if TYPE_CHECKING:
    from playwright.async_api import Page

_owned_pages: ContextVar[list[Page] | None] = ContextVar("crawl_worker_pages", default=None)


async def remember_crawl_page(page, **kwargs):
    pages = _owned_pages.get()
    if pages is not None and not kwargs["config"].session_id:
        pages.append(page)
    return page


class _PageTrackedWorker:
    async def crawl_url(self, *args, **kwargs):
        pages = []
        token = _owned_pages.set(pages)
        try:
            return await super().crawl_url(*args, **kwargs)
        except asyncio.CancelledError:
            # Cancelling an await does not necessarily close the browser navigation.
            await asyncio.gather(*(page.close() for page in pages), return_exceptions=True)
            raise
        finally:
            _owned_pages.reset(token)


class StreamingMemoryDispatcher(_PageTrackedWorker, MemoryAdaptiveDispatcher):
    def __init__(self, **options):
        super().__init__(**options)
        self._workers: set[asyncio.Task] = set()
        self._stopped = False

    async def crawl_url(self, *args, **kwargs):
        if self._stopped:
            raise asyncio.CancelledError
        worker = asyncio.current_task()
        self._workers.add(worker)
        try:
            return await super().crawl_url(*args, **kwargs)
        finally:
            self._workers.discard(worker)

    async def stop(self):
        # The 0.7 stream closes its memory monitor but leaves URL workers alive.
        self._stopped = True
        workers = list(self._workers)
        for worker in workers:
            worker.cancel()
        await asyncio.gather(*workers, return_exceptions=True)


class StreamingSemaphoreDispatcher(_PageTrackedWorker, SemaphoreDispatcher):
    async def run_urls_stream(self, urls, crawler, config):
        self.crawler = crawler
        semaphore = asyncio.Semaphore(self.semaphore_count)
        tasks = [
            asyncio.create_task(self.crawl_url(url, config, str(uuid.uuid4()), semaphore))
            for url in urls
        ]
        try:
            for task in asyncio.as_completed(tasks):
                yield await task
        finally:
            for task in tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)


async def stream_results(crawler, urls, config, dispatcher):
    """Close the dispatcher generator and its workers before leaving a crawl."""
    try:
        async with aclosing(dispatcher.run_urls_stream(urls=urls, crawler=crawler, config=config)) as stream:
            async for item in stream:
                yield item.result
    finally:
        if isinstance(dispatcher, StreamingMemoryDispatcher):
            await dispatcher.stop()


class DeepCrawlStreams:
    """Provide a fresh, owned dispatch stream for each traversal step."""

    def __init__(self, crawler):
        self._crawler = crawler
        self._stream = None

    async def arun_many(self, urls, config):
        await self.close()
        # Match the default rate limiter used by AsyncWebCrawler.arun_many.
        dispatcher = StreamingMemoryDispatcher(
            rate_limiter=RateLimiter(base_delay=(1.0, 3.0), max_delay=60.0, max_retries=3)
        )
        self._stream = stream_results(self._crawler, urls, config, dispatcher)
        return self._stream

    async def close(self):
        if self._stream is not None:
            await self._stream.aclose()
            self._stream = None

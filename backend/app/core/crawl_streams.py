"""Keep Crawl4AI 0.7.x streaming dispatch tasks scoped to their crawl."""
from __future__ import annotations

import asyncio
import time
import uuid
from contextlib import aclosing

from crawl4ai import MemoryAdaptiveDispatcher, SemaphoreDispatcher

from .crawl_attempts import PacedRateLimiter, RetryingCrawler

class StreamingMemoryDispatcher(MemoryAdaptiveDispatcher):
    def __init__(self, **options):
        super().__init__(**options)
        self._workers: set[asyncio.Task] = set()
        self._stopped = False
        self._next_queue_refresh = time.monotonic() + self.fairness_timeout

    async def _update_queue_priorities(self):
        # Until a URL ages past fairness_timeout, its priority only depends on
        # its retry count, which is already recorded when it enters the queue.
        if self.monitor or time.monotonic() >= self._next_queue_refresh:
            self._next_queue_refresh = time.monotonic() + self.check_interval
            await super()._update_queue_priorities()

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


class StreamingSemaphoreDispatcher(SemaphoreDispatcher):
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
    limiter = dispatcher.rate_limiter
    # Apply pacing inside the worker so it covers each attempt, including retries.
    dispatcher.rate_limiter = None
    retrying = RetryingCrawler(crawler, limiter)
    try:
        async with aclosing(dispatcher.run_urls_stream(urls=urls, crawler=retrying, config=config)) as stream:
            pending = asyncio.create_task(anext(stream, None))
            try:
                while (item := await pending) is not None:
                    # Keep dispatching while the caller saves the previous result.
                    pending = asyncio.create_task(anext(stream, None))
                    yield item.result
            finally:
                pending.cancel()
                await asyncio.gather(pending, return_exceptions=True)
    finally:
        if isinstance(dispatcher, StreamingMemoryDispatcher):
            await dispatcher.stop()
        dispatcher.rate_limiter = limiter


class DeepCrawlStreams:
    """Provide a fresh, owned dispatch stream for each traversal step."""

    def __init__(self, crawler):
        self._crawler = crawler
        self._stream = None
        self._rate_limiter = PacedRateLimiter(base_delay=(0.1, 0.2), max_delay=60.0, max_retries=3)

    async def arun_many(self, urls, config):
        await self.close()
        dispatcher = StreamingMemoryDispatcher(rate_limiter=self._rate_limiter)
        self._stream = stream_results(self._crawler, urls, config, dispatcher)
        return self._stream

    async def close(self):
        if self._stream is not None:
            await self._stream.aclose()
            self._stream = None

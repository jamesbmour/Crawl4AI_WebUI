"""Retry transient page failures before handing results to a job or traversal."""
from __future__ import annotations

import asyncio
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import TYPE_CHECKING

from crawl4ai import CacheMode, CrawlResult, RateLimiter
from crawl4ai.models import CrawlResultContainer

if TYPE_CHECKING:
    from crawl4ai import AsyncWebCrawler, CrawlerRunConfig
    from playwright.async_api import Page, Response


@dataclass
class _Attempt:
    pages: list[Page] = field(default_factory=list)
    http_error: CrawlResult | None = None


_attempt: ContextVar[_Attempt | None] = ContextVar("crawl_attempt", default=None)


async def remember_crawl_page(page: Page, *, config: CrawlerRunConfig, **kwargs) -> Page:
    attempt = _attempt.get()
    if attempt is not None and not config.session_id:
        attempt.pages.append(page)
    return page


async def reject_http_error(page: Page, *, url: str, response: Response | None, **kwargs) -> Page:
    attempt = _attempt.get()
    if attempt is not None and response is not None and response.status >= 400:
        # Crawl4AI 0.7 treats an HTTP error body as a successful scrape and can cache it.
        message = f"HTTP {response.status} {response.status_text}".strip()
        attempt.http_error = CrawlResult(
            url=url, redirected_url=response.url, html="", success=False,
            status_code=response.status, response_headers=response.headers, error_message=message,
        )
        raise RuntimeError(message)
    return page


class PacedRateLimiter(RateLimiter):
    """Space request starts per host, including when several workers are waiting."""

    def __init__(self, **options):
        super().__init__(**options)
        self._locks: dict[str, asyncio.Lock] = {}

    async def wait_if_needed(self, url: str) -> None:
        domain = self.get_domain(url)
        async with self._locks.setdefault(domain, asyncio.Lock()):
            await super().wait_if_needed(url)


async def _crawl_once(
    crawler: AsyncWebCrawler, url: str, config: CrawlerRunConfig, **kwargs
) -> CrawlResult:
    attempt = _Attempt()
    token = _attempt.set(attempt)
    try:
        try:
            result = await crawler.arun(url, config=config, **kwargs)
        except Exception as exc:
            result = CrawlResult(url=url, html="", success=False, error_message=str(exc))
        if attempt.http_error is not None:
            return attempt.http_error
        if isinstance(result, CrawlResultContainer):
            result = result[0]
        if result.status_code and result.status_code >= 400:
            result.success = False
            result.error_message = result.error_message or f"HTTP {result.status_code}"
        return result
    except asyncio.CancelledError:
        await asyncio.gather(*(page.close() for page in attempt.pages), return_exceptions=True)
        raise
    finally:
        _attempt.reset(token)


def _retry_delay(result: CrawlResult, retry: int) -> float:
    delay = (1 if result.status_code in (429, 503) else 0.25) * (2 ** retry)
    retry_after = (result.response_headers or {}).get("retry-after")
    if retry_after:
        try:
            return max(delay, int(retry_after))
        except ValueError:
            try:
                when = parsedate_to_datetime(retry_after)
                if when.tzinfo is None:
                    when = when.replace(tzinfo=timezone.utc)
                return max(delay, (when - datetime.now(timezone.utc)).total_seconds())
            except (TypeError, ValueError, OverflowError):
                pass
    return delay


class RetryingCrawler:
    def __init__(self, crawler: AsyncWebCrawler, rate_limiter: RateLimiter | None = None):
        self._crawler = crawler
        self._rate_limiter = rate_limiter

    async def arun(self, url: str, config: CrawlerRunConfig, **kwargs) -> CrawlResult:
        limiter = self._rate_limiter
        # Explicit scripts may have side effects, especially on a saved browser session.
        retryable = url.startswith(("http://", "https://")) and not (config.js_only or config.js_code)
        max_retries = 2 if retryable else 0
        for retry in range(max_retries + 1):
            if limiter is not None:
                await limiter.wait_if_needed(url)
            result = await _crawl_once(self._crawler, url, config, **kwargs)
            status = result.status_code
            within_rate_limit = True
            if limiter is not None and status:
                within_rate_limit = limiter.update_delay(url, status)
            if result.success or retry == max_retries or not within_rate_limit:
                return result
            if status and 400 <= status < 500 and status not in (408, 425, 429):
                return result
            delay = _retry_delay(result, retry)
            if delay > 60:
                return result
            await asyncio.sleep(delay)
            if config.cache_mode in (None, CacheMode.ENABLED, CacheMode.READ_ONLY):
                mode = CacheMode.BYPASS if config.cache_mode == CacheMode.READ_ONLY else CacheMode.WRITE_ONLY
                config = config.clone(cache_mode=mode)

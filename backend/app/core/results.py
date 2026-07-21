"""Serialize crawl4ai CrawlResult objects for the API and persist artifacts."""
from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any, Optional

from .settings import ARTIFACTS_DIR

# HTML larger than this is only available as an artifact download, not inline.
INLINE_HTML_LIMIT = 1_500_000


def artifact_dir(job_id: str, index: int) -> Path:
    d = ARTIFACTS_DIR / job_id / str(index)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def _ssl_to_dict(cert: Any) -> Optional[dict[str, Any]]:
    if cert is None:
        return None
    for attr in ("to_dict", "to_json"):
        fn = getattr(cert, attr, None)
        if callable(fn):
            try:
                value = fn()
                if isinstance(value, str):
                    return json.loads(value)
                if isinstance(value, dict):
                    return value
            except Exception:
                continue
    # Fallback: pick common fields defensively
    out = {}
    for field in ("issuer", "subject", "valid_from", "valid_until", "fingerprint"):
        value = getattr(cert, field, None)
        if value is not None:
            out[field] = value
    return out or None


def serialize_result(result: Any, job_id: str, index: int) -> dict[str, Any]:
    """Convert a CrawlResult into a JSON-safe dict, writing large/binary pieces
    to the artifact store and recording their filenames."""
    adir = artifact_dir(job_id, index)
    artifacts: list[str] = []

    def save_artifact(name: str, data: bytes | str) -> None:
        path = adir / name
        if isinstance(data, bytes):
            path.write_bytes(data)
        else:
            _write_text(path, data)
        artifacts.append(name)

    md = getattr(result, "markdown", None)
    raw_markdown = getattr(md, "raw_markdown", None) if md is not None else None
    fit_markdown = getattr(md, "fit_markdown", None) if md is not None else None
    citations = getattr(md, "markdown_with_citations", None) if md is not None else None
    references = getattr(md, "references_markdown", None) if md is not None else None
    if raw_markdown is None and md is not None:
        raw_markdown = str(md)

    if raw_markdown:
        save_artifact("result.md", raw_markdown)
    if fit_markdown:
        save_artifact("result.fit.md", fit_markdown)

    html = getattr(result, "html", None) or ""
    cleaned_html = getattr(result, "cleaned_html", None) or ""
    if html:
        save_artifact("page.html", html)
    if cleaned_html:
        save_artifact("cleaned.html", cleaned_html)

    screenshot_b64 = getattr(result, "screenshot", None)
    if screenshot_b64:
        try:
            save_artifact("screenshot.png", base64.b64decode(screenshot_b64))
        except Exception:
            screenshot_b64 = None

    pdf_bytes = getattr(result, "pdf", None)
    if pdf_bytes:
        save_artifact("page.pdf", pdf_bytes)

    mhtml = getattr(result, "mhtml", None)
    if mhtml:
        save_artifact("page.mhtml", mhtml)

    extracted = getattr(result, "extracted_content", None)
    extracted_parsed: Any = None
    if extracted:
        save_artifact("extracted.json", extracted)
        try:
            extracted_parsed = json.loads(extracted)
        except (json.JSONDecodeError, TypeError):
            extracted_parsed = extracted

    network = getattr(result, "network_requests", None)
    if network:
        save_artifact("network.json", json.dumps(network, indent=2, default=str))
    console = getattr(result, "console_messages", None)
    if console:
        save_artifact("console.json", json.dumps(console, indent=2, default=str))

    return {
        "index": index,
        "url": getattr(result, "url", None),
        "redirected_url": getattr(result, "redirected_url", None),
        "success": bool(getattr(result, "success", False)),
        "status_code": getattr(result, "status_code", None),
        "error_message": getattr(result, "error_message", None),
        "session_id": getattr(result, "session_id", None),
        "metadata": getattr(result, "metadata", None),
        "response_headers": getattr(result, "response_headers", None),
        "ssl_certificate": _ssl_to_dict(getattr(result, "ssl_certificate", None)),
        "markdown": raw_markdown,
        "fit_markdown": fit_markdown,
        "markdown_with_citations": citations,
        "references_markdown": references,
        "cleaned_html": cleaned_html if len(cleaned_html) <= INLINE_HTML_LIMIT else None,
        "html": html if len(html) <= INLINE_HTML_LIMIT else None,
        "html_truncated": len(html) > INLINE_HTML_LIMIT,
        "links": getattr(result, "links", None),
        "media": getattr(result, "media", None),
        "tables": getattr(result, "tables", None),
        "extracted_content": extracted_parsed,
        "screenshot": bool(screenshot_b64),
        "pdf": bool(pdf_bytes),
        "mhtml": bool(mhtml),
        "network_requests_count": len(network) if network else 0,
        "console_messages": console,
        "network_requests": (network[:200] if network else None),
        "artifacts": artifacts,
        # deep-crawl metadata (present when deep_crawl_strategy set it)
        "depth": (getattr(result, "metadata", None) or {}).get("depth"),
        "score": (getattr(result, "metadata", None) or {}).get("score"),
    }

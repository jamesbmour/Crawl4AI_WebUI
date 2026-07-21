"""App settings endpoints (LLM provider config)."""
from __future__ import annotations

from fastapi import APIRouter

from ..core.mapping import REGEX_BUILTIN_KEYS
from ..core.settings import public_settings, save_settings
from ..models.schemas import SettingsIn

router = APIRouter()


@router.get("/settings")
async def get_settings():
    return public_settings()


@router.put("/settings")
async def put_settings(body: SettingsIn):
    update = body.model_dump(exclude_none=True)
    # Empty string clears a value; masked token placeholder means "keep".
    token = update.get("llm_api_token")
    if token and token.startswith("********"):
        update.pop("llm_api_token")
    save_settings(update)
    return public_settings()


@router.get("/meta")
async def get_meta():
    """Static metadata the frontend needs (option lists etc.)."""
    try:
        from crawl4ai.__version__ import __version__ as c4ai_version
    except ImportError:
        c4ai_version = "unknown"

    return {
        "crawl4ai_version": c4ai_version,
        "regex_builtin_patterns": REGEX_BUILTIN_KEYS,
    }

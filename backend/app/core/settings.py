"""App settings persisted to data/settings.json (LLM provider config, defaults)."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Optional

def _resolve_data_dir() -> Path:
    """Pick a writable data directory.

    Honors C4AI_WEBUI_DATA when set and writable. Falls back to the repo-local
    ./data for local runs, and finally to /tmp on read-only container
    filesystems (e.g. Vercel serverless, where only /tmp is writable).
    """
    candidates = []
    env = os.environ.get("C4AI_WEBUI_DATA")
    if env:
        candidates.append(Path(env))
    candidates.append(Path(__file__).resolve().parents[3] / "data")
    candidates.append(Path("/tmp/c4ai-webui-data"))

    for candidate in candidates:
        try:
            candidate.mkdir(parents=True, exist_ok=True)
            probe = candidate / ".write_test"
            probe.touch()
            probe.unlink()
            return candidate
        except OSError:
            continue
    # Last resort: return /tmp path even if the probe failed; ensure_dirs will surface any error.
    return Path("/tmp/c4ai-webui-data")


DATA_DIR = _resolve_data_dir()
ARTIFACTS_DIR = DATA_DIR / "artifacts"
SETTINGS_PATH = DATA_DIR / "settings.json"
DB_PATH = DATA_DIR / "app.db"

_DEFAULTS: dict[str, Any] = {
    "llm_provider": "",
    "llm_api_token": "",
    "llm_base_url": "",
    "llm_temperature": None,
    "llm_max_tokens": None,
}


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


def load_settings() -> dict[str, Any]:
    ensure_dirs()
    if SETTINGS_PATH.exists():
        try:
            data = json.loads(SETTINGS_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            data = {}
    else:
        data = {}
    merged = {**_DEFAULTS, **data}
    return merged


def save_settings(update: dict[str, Any]) -> dict[str, Any]:
    ensure_dirs()
    current = load_settings()
    for key, value in update.items():
        if key in _DEFAULTS and value is not None:
            current[key] = value
    SETTINGS_PATH.write_text(json.dumps(current, indent=2))
    try:
        os.chmod(SETTINGS_PATH, 0o600)
    except OSError:
        pass
    return current


def public_settings() -> dict[str, Any]:
    """Settings safe to return to the frontend (token masked)."""
    s = load_settings()
    token = s.get("llm_api_token") or ""
    s["llm_api_token"] = ("*" * 8 + token[-4:]) if token else ""
    s["llm_configured"] = llm_is_configured()
    return s


def llm_is_configured() -> bool:
    s = load_settings()
    if not s.get("llm_provider"):
        return False
    # Local providers (ollama) don't need a token.
    if str(s["llm_provider"]).startswith("ollama"):
        return True
    return bool(s.get("llm_api_token")) or _provider_env_token_present(s["llm_provider"])


def _provider_env_token_present(provider: str) -> bool:
    env_by_prefix = {
        "openai": "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "gemini": "GEMINI_API_KEY",
        "groq": "GROQ_API_KEY",
        "deepseek": "DEEPSEEK_API_KEY",
    }
    for prefix, env in env_by_prefix.items():
        if provider.startswith(prefix):
            return bool(os.environ.get(env))
    return False


def get_llm_config() -> Optional["object"]:
    """Build a crawl4ai LLMConfig from stored settings, or None if unconfigured."""
    if not llm_is_configured():
        return None
    from crawl4ai import LLMConfig  # imported lazily; heavy module

    s = load_settings()
    kwargs: dict[str, Any] = {"provider": s["llm_provider"]}
    if s.get("llm_api_token"):
        kwargs["api_token"] = s["llm_api_token"]
    if s.get("llm_base_url"):
        kwargs["base_url"] = s["llm_base_url"]
    if s.get("llm_temperature") is not None:
        kwargs["temperature"] = s["llm_temperature"]
    if s.get("llm_max_tokens") is not None:
        kwargs["max_tokens"] = s["llm_max_tokens"]
    return LLMConfig(**kwargs)

"""JSON file persistence for interviews as a reliable backup."""
import json
import os
from pathlib import Path
from threading import Lock
from datetime import datetime, timezone

from . import config

_LOCK = Lock()
_DATA_DIR = Path(config.BACKEND_DIR) / "data"
_DATA_DIR.mkdir(parents=True, exist_ok=True)
_FILE = _DATA_DIR / "interviews.json"


def _load() -> dict:
    if not _FILE.exists():
        return {}
    try:
        with open(_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save(data: dict) -> None:
    with open(_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_full_session(session_id: str, data: dict) -> None:
    with _LOCK:
        store = _load()
        store[session_id] = {
            **data,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        _save(store)


def get_full_session(session_id: str) -> dict | None:
    with _LOCK:
        store = _load()
        return store.get(session_id)


def list_all() -> dict:
    with _LOCK:
        return _load()

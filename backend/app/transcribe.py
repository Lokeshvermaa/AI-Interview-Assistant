"""Turns a recorded audio answer into text using Groq's Whisper model."""

import os
import tempfile
from functools import lru_cache

from groq import Groq

from . import config
from .llm import error_message


@lru_cache(maxsize=1)
def _client() -> Groq:
    if not config.GROQ_API_KEY:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Add it to backend/.env to enable voice input."
        )
    return Groq(api_key=config.GROQ_API_KEY)


def transcribe(data: bytes, filename: str = "audio.webm", language: str = "en") -> str:
    """Transcribe raw audio bytes to text using Groq Whisper."""
    suffix = os.path.splitext(filename)[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
        tmp.write(data)
        tmp.flush()
        with open(tmp.name, "rb") as handle:
            try:
                result = _client().audio.transcriptions.create(
                    file=(filename, handle.read()),
                    model=config.ASR_MODEL,
                    language=language or None,
                )
            except RuntimeError:
                raise
            except Exception as exc:
                raise RuntimeError(error_message(exc)) from exc
    return (getattr(result, "text", "") or "").strip()

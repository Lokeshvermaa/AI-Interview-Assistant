"""Simple speaking stats worked out from an answer's text: word count,
words per minute and how many filler words were used."""

import re

FILLERS = [
    "um",
    "uh",
    "erm",
    "like",
    "you know",
    "basically",
    "actually",
    "sort of",
    "kind of",
]

_WORD_RE = re.compile(r"[A-Za-z']+")


def analyze(text: str, duration_sec: float | None = None) -> dict:
    """Word count, pace (WPM) and filler-word usage for an answer."""
    text = (text or "").strip().lower()
    words = _WORD_RE.findall(text)
    word_count = len(words)

    fillers: dict[str, int] = {}
    for filler in FILLERS:
        count = len(re.findall(rf"\b{re.escape(filler)}\b", text))
        if count:
            fillers[filler] = count
    filler_count = sum(fillers.values())

    wpm = None
    duration = float(duration_sec) if duration_sec else None
    if duration and duration > 0:
        wpm = round(word_count / (duration / 60.0), 1)

    return {
        "word_count": word_count,
        "duration_sec": round(duration, 1) if duration else None,
        "wpm": wpm,
        "filler_count": filler_count,
        "fillers": fillers,
    }

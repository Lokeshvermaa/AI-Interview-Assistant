"""Saves finished interviews to ChromaDB so they stick around after a restart.

Everything for one interview is stored in the `interviews` collection, tagged
with its session_id. Question, answer, chat turn and session records all keep
the same tag, which is how we rebuild a report or list past interviews later.
"""

import json
import threading
from datetime import datetime, timezone

from langchain_chroma import Chroma

from . import config
from .chroma_client import get_client
from .embeddings import get_embeddings

_lock = threading.Lock()
_collection: Chroma | None = None


def get_collection() -> Chroma:
    # Shared by every request, so build it once.
    global _collection
    if _collection is None:
        with _lock:
            if _collection is None:
                _collection = Chroma(
                    client=get_client(),
                    collection_name=config.INTERVIEW_COLLECTION,
                    embedding_function=get_embeddings(),
                )
    return _collection


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean(metadata: dict) -> dict:
    # Chroma metadata can only hold simple values, so turn lists/dicts into JSON strings.
    out: dict = {}
    for key, value in metadata.items():
        if value is None:
            continue
        if isinstance(value, (list, dict)):
            out[key] = json.dumps(value)
        else:
            out[key] = value
    return out


def save_questions(session_id: str, questions: list[dict]) -> int:
    ids, texts, metadatas = [], [], []
    for i, q in enumerate(questions):
        ids.append(f"{session_id}-q{i}")
        texts.append(q.get("question", ""))
        metadatas.append(
            _clean(
                {
                    "session_id": session_id,
                    "kind": "question",
                    "index": i,
                    "type": q.get("type", ""),
                    "difficulty": q.get("difficulty", ""),
                    "created_at": _now(),
                }
            )
        )
    if ids:
        get_collection().add_texts(texts, metadatas=metadatas, ids=ids)
    return len(ids)


def save_answer(session_id: str, index: int, question: str, answer: str, evaluation: dict) -> None:
    voice = evaluation.get("voice") or {}
    get_collection().add_texts(
        [answer],
        ids=[f"{session_id}-a{index}"],
        metadatas=[
            _clean(
                {
                    "session_id": session_id,
                    "kind": "answer",
                    "index": index,
                    "question": question,
                    "score": int(evaluation.get("score", 0)),
                    "verdict": evaluation.get("verdict", ""),
                    "strengths": evaluation.get("strengths", []),
                    "improvements": evaluation.get("improvements", []),
                    "model_answer": evaluation.get("model_answer", ""),
                    "word_count": voice.get("word_count"),
                    "duration_sec": voice.get("duration_sec"),
                    "wpm": voice.get("wpm"),
                    "filler_count": voice.get("filler_count"),
                    "fillers": voice.get("fillers", {}),
                    "created_at": _now(),
                }
            )
        ],
    )


def save_turn(session_id: str, index: int, role: str, content: str) -> None:
    get_collection().add_texts(
        [content],
        ids=[f"{session_id}-t{index}"],
        metadatas=[
            _clean(
                {
                    "session_id": session_id,
                    "kind": "turn",
                    "index": index,
                    "role": role,
                    "created_at": _now(),
                }
            )
        ],
    )


def save_session(
    session_id: str,
    title: str,
    average_score: float,
    questions_asked: int,
    answers_evaluated: int,
    created_at: str | None = None,
) -> None:
    # One summary row per interview. Updated as the interview goes on.
    # The History page reads these to let you compare interviews.
    get_collection().add_texts(
        [title or "Untitled interview"],
        ids=[f"{session_id}-session"],
        metadatas=[
            _clean(
                {
                    "session_id": session_id,
                    "kind": "session",
                    "title": title or "Untitled interview",
                    "average_score": float(average_score),
                    "questions_asked": int(questions_asked),
                    "answers_evaluated": int(answers_evaluated),
                    "created_at": created_at or _now(),
                }
            )
        ],
    )


def list_sessions() -> list[dict]:
    data = get_collection().get(where={"kind": "session"})
    metadatas = data.get("metadatas") or []
    sessions = [
        {
            "session_id": m.get("session_id"),
            "title": m.get("title", "Untitled interview"),
            "average_score": m.get("average_score", 0.0),
            "questions_asked": m.get("questions_asked", 0),
            "answers_evaluated": m.get("answers_evaluated", 0),
            "created_at": m.get("created_at", ""),
        }
        for m in metadatas
    ]
    sessions.sort(key=lambda s: s.get("created_at", ""), reverse=True)
    return sessions


def get_session(session_id: str) -> dict:
    # Pull every record for this session and sort them back into
    # questions, answers, transcript turns and the session summary.
    data = get_collection().get(where={"session_id": session_id})
    metadatas = data.get("metadatas") or []
    documents = data.get("documents") or []

    questions: list[tuple[int, dict]] = []
    answers: list[tuple[int, dict]] = []
    turns: list[tuple[int, dict]] = []
    meta: dict = {}

    for metadata, doc in zip(metadatas, documents):
        kind = metadata.get("kind")
        idx = int(metadata.get("index", 0))
        if kind == "question":
            questions.append(
                (
                    idx,
                    {
                        "question": doc,
                        "type": metadata.get("type", ""),
                        "difficulty": metadata.get("difficulty", ""),
                    },
                )
            )
        elif kind == "answer":
            answers.append(
                (
                    idx,
                    {
                        "question": metadata.get("question", ""),
                        "answer": doc,
                        "score": metadata.get("score", 0),
                        "verdict": metadata.get("verdict", ""),
                        "strengths": _load(metadata.get("strengths"), []),
                        "improvements": _load(metadata.get("improvements"), []),
                        "model_answer": metadata.get("model_answer", ""),
                        "voice": {
                            "word_count": metadata.get("word_count"),
                            "duration_sec": metadata.get("duration_sec"),
                            "wpm": metadata.get("wpm"),
                            "filler_count": metadata.get("filler_count", 0),
                            "fillers": _load(metadata.get("fillers"), {}),
                        },
                    },
                )
            )
        elif kind == "turn":
            turns.append((idx, {"role": metadata.get("role", ""), "content": doc}))
        elif kind == "session":
            meta = {
                "title": metadata.get("title", ""),
                "created_at": metadata.get("created_at", ""),
                "average_score": metadata.get("average_score", 0.0),
            }

    questions.sort(key=lambda item: item[0])
    answers.sort(key=lambda item: item[0])
    turns.sort(key=lambda item: item[0])
    return {
        "questions": [q for _, q in questions],
        "answers": [a for _, a in answers],
        "transcript": [t for _, t in turns],
        "meta": meta,
    }


def _load(raw, fallback):
    if not raw:
        return fallback
    try:
        return json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return fallback

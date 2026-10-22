"""Holds each interview in memory while the user is going through it.

This is only temporary state; the finished interview is saved to ChromaDB by
interview_store.py so it survives a restart.
"""

from dataclasses import dataclass, field
from uuid import uuid4

from .agent import InterviewAgent


@dataclass
class Session:
    id: str
    resume_text: str = ""
    jd_text: str = ""
    title: str = ""
    questions: list[dict] = field(default_factory=list)
    agent: InterviewAgent | None = None
    transcript: list[dict] = field(default_factory=list)
    evaluations: list[dict] = field(default_factory=list)


SESSIONS: dict[str, Session] = {}


def create_session(
    resume_text: str = "", jd_text: str = "", title: str = ""
) -> Session:
    session = Session(
        id=uuid4().hex, resume_text=resume_text, jd_text=jd_text, title=title
    )
    SESSIONS[session.id] = session
    return session


def get_session(session_id: str) -> Session | None:
    return SESSIONS.get(session_id)

"""The backend API. Each function below handles one URL the frontend calls."""

from fastapi import APIRouter, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import chroma_store, chains, config, interview_store, json_store, voice
from .agent import InterviewAgent
from .parsers import extract_text
from .sessions import Session, create_session, get_session
from .transcribe import transcribe

app = FastAPI(title="AI Interview Assistant", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()


class QuestionsRequest(BaseModel):
    session_id: str
    n: int = 5


class InterviewRequest(BaseModel):
    session_id: str
    message: str = ""


class EvaluateRequest(BaseModel):
    session_id: str
    question: str
    answer: str
    duration_sec: float | None = None


@app.exception_handler(RuntimeError)
async def runtime_error_handler(request: Request, exc: RuntimeError) -> JSONResponse:
    return JSONResponse(status_code=503, content={"detail": str(exc)})


def _require_session(session_id: str) -> Session:
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Unknown session_id. Call /ingest first.")
    return session


def _make_title(jd: str, resume: str) -> str:
    for source in (jd, resume):
        for line in source.splitlines():
            line = line.strip()
            if line:
                return line[:70]
    return "Untitled interview"


def _persist_summary(session: Session) -> None:
    scores = [e.get("score", 0) for e in session.evaluations]
    average = round(sum(scores) / len(scores), 2) if scores else 0.0
    interview_store.save_session(
        session_id=session.id,
        title=session.title,
        average_score=average,
        questions_asked=len(session.questions),
        answers_evaluated=len(session.evaluations),
    )
    try:
        json_store.save_full_session(
            session.id,
            {
                "session_id": session.id,
                "title": session.title,
                "questions": session.questions,
                "evaluations": session.evaluations,
                "transcript": session.transcript,
                "meta": {"title": session.title},
            },
        )
    except Exception:
        pass


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.post("/ingest")
async def ingest(
    resume_file: UploadFile | None = File(None),
    jd_file: UploadFile | None = File(None),
    resume_text: str = Form(""),
    jd_text: str = Form(""),
    session_id: str = Form(""),
) -> dict:
    """Accept résumé/JD as files (PDF/DOCX/TXT) and/or pasted text."""
    resume = (resume_text or "").strip()
    jd = (jd_text or "").strip()

    try:
        if resume_file is not None and resume_file.filename:
            data = await resume_file.read()
            resume = await run_in_threadpool(
                extract_text, resume_file.filename, data
            )
        if jd_file is not None and jd_file.filename:
            data = await jd_file.read()
            jd = await run_in_threadpool(extract_text, jd_file.filename, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not resume and not jd:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one résumé or job description (file or text).",
        )

    # Embedding loads torch and the model, which takes a while on a small host.
    # Run it off the event loop so /health keeps answering and the instance is
    # not restarted mid-request.
    def _index() -> int:
        docs = []
        if resume:
            docs += chroma_store.split_text(resume, source="resume")
        if jd:
            docs += chroma_store.split_text(jd, source="jd")
        return chroma_store.add_documents(docs)

    chunks = await run_in_threadpool(_index)

    session = get_session(session_id) if session_id else None
    if session is None:
        session = create_session(
            resume_text=resume, jd_text=jd, title=_make_title(jd, resume)
        )
    else:
        session.resume_text = resume or session.resume_text
        session.jd_text = jd or session.jd_text
        session.title = session.title or _make_title(session.jd_text, session.resume_text)

    return {
        "session_id": session.id,
        "resume_chars": len(session.resume_text),
        "jd_chars": len(session.jd_text),
        "chunks_indexed": chunks,
    }


@router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)) -> dict:
    """Transcribe a recorded audio answer using Groq Whisper."""
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio file.")
    text = await run_in_threadpool(
        transcribe, data, audio.filename or "audio.webm"
    )
    return {"text": text}


@router.post("/questions")
def questions(req: QuestionsRequest) -> dict:
    session = _require_session(req.session_id)
    if not session.resume_text and not session.jd_text:
        raise HTTPException(status_code=400, detail="Session has no résumé/JD context.")

    generated = chains.generate_questions(
        jd_text=session.jd_text,
        resume_text=session.resume_text,
        n=max(1, min(req.n, 15)),
    )
    session.questions = generated
    session.agent = InterviewAgent([q["question"] for q in generated])
    interview_store.save_questions(session.id, generated)
    _persist_summary(session)
    return {"questions": generated}


@router.post("/interview")
def interview(req: InterviewRequest) -> dict:
    session = _require_session(req.session_id)
    if session.agent is None:
        raise HTTPException(
            status_code=400, detail="No interview started. Call /questions first."
        )

    if req.message:
        session.transcript.append({"role": "candidate", "content": req.message})
        interview_store.save_turn(
            session.id, len(session.transcript) - 1, "candidate", req.message
        )
        reply = session.agent.respond(req.message)
    else:
        reply = session.agent.start()

    session.transcript.append({"role": "interviewer", "content": reply})
    interview_store.save_turn(
        session.id, len(session.transcript) - 1, "interviewer", reply
    )
    try:
        _persist_summary(session)
    except Exception:
        pass
    return {"reply": reply, "done": session.agent.done, "transcript": session.transcript}


@router.post("/evaluate")
def evaluate(req: EvaluateRequest) -> dict:
    session = _require_session(req.session_id)
    result = chains.grade_answer(req.question, req.answer)
    metrics = voice.analyze(req.answer, req.duration_sec)
    entry = {"question": req.question, "answer": req.answer, "voice": metrics, **result}
    index = len(session.evaluations)
    session.evaluations.append(entry)
    interview_store.save_answer(session.id, index, req.question, req.answer, entry)
    try:
        _persist_summary(session)
    except Exception:
        pass
    return entry


@router.get("/interviews")
def interviews() -> dict:
    """List past interviews (newest first) for comparison."""
    sessions = interview_store.list_sessions()
    return {"interviews": sessions, "count": len(sessions)}


@router.get("/report/{session_id}")
def report(session_id: str) -> dict:
    # Try JSON first (most reliable)
    json_data = None
    try:
        json_data = json_store.get_full_session(session_id)
    except Exception:
        json_data = None

    stored = interview_store.get_session(session_id)
    questions = stored.get("questions") or []
    evaluations = stored.get("answers") or []
    transcript = stored.get("transcript") or []
    meta = stored.get("meta") or {}

    if json_data:
        questions = json_data.get("questions") or questions
        evaluations = json_data.get("evaluations") or evaluations
        transcript = json_data.get("transcript") or transcript
        if json_data.get("meta"):
            meta = {**meta, **json_data.get("meta")}

    if not questions and not evaluations:
        session = get_session(session_id)
        if session is None and not json_data:
            raise HTTPException(
                status_code=404, detail="No report found for this session."
            )
        if session:
            questions = session.questions
            evaluations = session.evaluations
            transcript = session.transcript
            meta = {"title": session.title, "created_at": "", "average_score": 0.0}

    scores = [e.get("score", 0) for e in evaluations]
    average = round(sum(scores) / len(scores), 2) if scores else 0.0
    return {
        "session_id": session_id,
        "title": meta.get("title", json_data.get("title") if json_data else ""),
        "created_at": meta.get("created_at", json_data.get("updated_at") if json_data else ""),
        "questions_asked": len(questions),
        "answers_evaluated": len(evaluations),
        "average_score": average,
        "evaluations": evaluations,
        "transcript": transcript,
        "questions": questions,
    }


# The same routes are registered twice on purpose:
#   - without a prefix  -> /health, used by the Vite dev proxy (it strips /api)
#   - with the /api prefix -> /api/health, used by the built frontend in production
app.include_router(router)
app.include_router(router, prefix="/api", include_in_schema=False)


class SPAStaticFiles(StaticFiles):
    """Serves the React build and falls back to index.html for unknown paths."""

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404 and not scope["path"].startswith("/api"):
                return await super().get_response("index.html", scope)
            raise


if config.FRONTEND_DIST.is_dir():
    # Mounted last so the API routes and /docs still win.
    app.mount(
        "/",
        SPAStaticFiles(directory=str(config.FRONTEND_DIST), html=True),
        name="frontend",
    )
else:

    @app.get("/")
    def root() -> dict:
        return {
            "service": "AI Interview Assistant",
            "docs": "/docs",
            "note": "Frontend build not found. Run npm run build in frontend/.",
        }

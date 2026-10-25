# AI Interview Assistant

A RAG-powered mock interview app. Upload a résumé and job description (PDF, DOCX, TXT, or paste text), answer by voice or typing, get role-specific questions, and receive feedback with scores and speaking metrics.

## Tech stack

- **Backend:** FastAPI, LangChain, Groq (LLM + Whisper), Hugging Face `sentence-transformers` embeddings, ChromaDB, pypdf/python-docx
- **Frontend:** React + Vite + Tailwind CSS, browser `MediaRecorder`, `speechSynthesis`

## How it works

```
Résumé + Job Description (PDF/DOCX/TXT or text)
        │  parse → chunk → embed (sentence-transformers)
        ▼
   ChromaDB vector store
        │  retrieve relevant chunks for RAG
        ▼
 Groq via LangChain
   ├─ generate role-specific questions
   ├─ run a mock interview
   └─ grade answers with feedback and metrics
        │
 Voice answer → Groq Whisper transcription → speaking metrics (WPM, filler words)
        │
        ▼
 Report (scores, strengths, improvements, recommendations, transcript, fillers)
```

**RAG retrieval:** On ingest, the app chunks and embeds resume/JD text with `sentence-transformers`, stores them in ChromaDB (`interview_context`). When generating questions and during evaluation, relevant chunks are retrieved from that store and passed as context to the Groq model to keep questions and feedback grounded in the uploaded documents.

## Setup

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # add GROQ_API_KEY
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. In dev, Vite proxies `/api/*` to `:8000` and strips `/api`.

## Endpoints

Routes exist at both `/...` (dev proxy) and `/api/...` (production build).

| Method | Path | Description |
|---|---|---|
| POST | `/ingest` | Upload résumé/JD or pasted text and index in ChromaDB |
| POST | `/questions` | Generate questions from indexed context |
| POST | `/interview` | Interview chat turn |
| POST | `/transcribe` | Transcribe recorded audio (Groq Whisper) |
| POST | `/evaluate` | Grade an answer with feedback and speaking metrics |
| GET | `/interviews` | List saved interviews |
| GET | `/report/{session_id}` | Full report with evaluations, transcript, and data |
| GET | `/health` | Health check |

## Deployment (Render)

See `backend/README_RENDER.md` for details. Build/start commands and env vars as configured.

### Verify deployment

```bash
cd backend
python scripts/smoke_test.py https://your-app.onrender.com
```

### Notes on hosting

- **Cold start:** Free Render instances may sleep after inactivity.
- **Storage:** On Render's free tier, disk is ephemeral. Interview data, reports, and ChromaDB contents can be lost on restarts/redeploys. A persistent disk is needed for long-term retention.
- **Resources:** CPU-only PyTorch build is used to reduce memory usage.

## Limitations

- Voice answers require microphone permission.
- Only text-based PDFs are supported (no OCR for scanned documents).
- No authentication yet (demo use).
- Sample files in `backend/data/`.

## Data & persistence

The app uses ChromaDB (`backend/chroma_db/`, gitignored):
- `interview_context`: résumé/JD chunks for RAG
- `interviews`: questions, answers/evaluations (with scores, feedback, voice metrics/fillers), transcript turns, and session summaries

Data is stored via `interview_store.py`. A local JSON backup may also be written under `backend/data/`. On Render free-tier ephemeral storage, all saved data can be lost after restarts or redeployments.

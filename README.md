# AI Interview Assistant

A RAG-powered mock-interview app. Upload a résumé and a job description (PDF, DOCX or
TXT — or paste text), answer by **voice or typing**, and get tailored questions plus
instant AI feedback with content scores and speaking metrics.

## Tech stack

- **Backend:** FastAPI, LangChain, Groq (free LLM + Whisper speech-to-text), Hugging
  Face `sentence-transformers` embeddings, ChromaDB vector store, pypdf / python-docx
  for parsing
- **Frontend:** React + Vite + Tailwind CSS (single-page step wizard), browser
  `MediaRecorder` for voice input and `speechSynthesis` for spoken questions

## How it works

```
Résumé + Job Description (PDF/DOCX/TXT or text)
        │  parse → chunk → embed (sentence-transformers)
        ▼
   ChromaDB vector store
        │
        ▼
 RAG chains (Groq)
   ├─ generate tailored questions
   ├─ conversational mock-interview agent
   └─ grade answers + feedback
        │
   Voice answer → Whisper transcription → speaking metrics (WPM, filler words)
        │
        ▼
      Report
```

## Setup

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then add your free GROQ_API_KEY
uvicorn app.main:app --reload
```

Get a free API key at https://console.groq.com/keys.

API docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api/*` to the backend on
port 8000 and **strips the `/api` prefix**, so a request to `/api/ingest` reaches the
backend's `/ingest` route. No CORS setup is needed in development.

## Endpoints

Every route is available twice: once at the plain path (used by the Vite dev proxy,
which strips `/api`) and once under `/api` (used by the built frontend in production).

| Method | Path | Description |
|---|---|---|
| POST | `/ingest` | Upload résumé/JD (multipart) or pasted text → index in Chroma |
| POST | `/questions` | Generate tailored interview questions |
| POST | `/interview` | Mock-interview chat turn |
| POST | `/transcribe` | Transcribe a recorded audio answer (Groq Whisper) |
| POST | `/evaluate` | Grade an answer (+ speaking metrics) and return feedback |
| GET | `/interviews` | List past interviews (date, title, average score) |
| GET | `/report/{session_id}` | Session summary, evaluations and full transcript |
| GET | `/health` | Liveness check (used by the host) |

## Deployment

The app is deployed as a **single service**: FastAPI serves the API *and* the built
React app, so there is one URL and no CORS configuration.

### Render (free tier)

The repo contains a `render.yaml` blueprint:

1. Push the code to GitHub.
2. In Render: **New → Blueprint** → select the repo → apply.
3. Fill in the two secrets it asks for:
   - `GROQ_API_KEY` — from https://console.groq.com/keys
   - `CORS_ORIGINS` — your Render URL, e.g. `https://ai-interview-assistant.onrender.com`
4. Deploy. The build installs the Python dependencies, builds the frontend and
   pre-downloads the embedding model into the image.

<details>
<summary>Manual setup instead of the blueprint</summary>

| Field | Value |
|---|---|
| Root directory | `backend` |
| Build command | `npm --prefix ../frontend ci && npm --prefix ../frontend run build && pip install -r requirements.txt && python scripts/preload_model.py` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/health` |

Environment variables: `GROQ_API_KEY`, `CORS_ORIGINS`, `PYTHON_VERSION=3.13.5`,
`HF_HOME=/opt/render/project/src/backend/.hf_cache`, `OMP_NUM_THREADS=1`,
`TOKENIZERS_PARALLELISM=false`.
</details>

### Verify a deployment

```bash
cd backend
python scripts/smoke_test.py https://your-app.onrender.com
```

It walks the whole flow (health → ingest → questions → interview → evaluate →
report → past interviews) and exits non-zero if anything fails.

### Free-tier notes

- **Cold start.** Free instances sleep after 15 minutes idle, so the first visitor
  waits 1–3 minutes while the app wakes up.
- **Storage is ephemeral.** Saved interviews live on the instance disk and are
  cleared on every new deploy. The **Past Interviews** tab works within a session
  but starts empty after a redeploy. Add a persistent disk to keep it.
- **512 MB RAM.** `requirements.txt` pins a CPU-only PyTorch build (the default
  CUDA build is several GB larger) and the thread limits above keep memory down.

## Notes

- Voice answers need microphone permission in the browser (localhost is fine).
- Only text-based PDFs are supported (no OCR for scanned documents).
- Sample files live in `backend/data/` for a quick demo.
- `/report/{session_id}` returns any session whose id you have. There is no
  account system yet, so it is fine for a single-user demo — a login/roles system
  is the natural next step.

## Data & persistence (ChromaDB)

Everything the app stores goes through ChromaDB (`backend/chroma_db/`), in two collections:

| Collection | Contents | Purpose |
|---|---|---|
| `interview_context` | Résumé + JD chunks (embedded) | RAG retrieval for question generation |
| `interviews` | Questions, graded answers, full transcript, and a per-session summary | Rebuild reports + compare interviews, survives restarts |

- Each record is tagged with its `session_id`. Record kinds: `question`, `answer`,
  `turn` (transcript), and `session` (summary).
- `GET /report/{session_id}` reads straight from Chroma, so reports and transcripts
  keep working after a backend restart.
- `GET /interviews` lists every session with its date, title, and average score, so you
  can compare and see which interview performed best. The **Past Interviews** tab in the
  UI opens any past session with its full transcript.
- The Chroma directory is gitignored and created automatically on first use.

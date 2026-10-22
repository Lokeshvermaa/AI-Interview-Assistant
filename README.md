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
port 8000, so no CORS setup is needed in development.

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/ingest` | Upload résumé/JD (multipart) or pasted text → index in Chroma |
| POST | `/questions` | Generate tailored interview questions |
| POST | `/interview` | Mock-interview chat turn |
| POST | `/transcribe` | Transcribe a recorded audio answer (Groq Whisper) |
| POST | `/evaluate` | Grade an answer (+ speaking metrics) and return feedback |
| GET | `/interviews` | List past interviews (date, title, average score) |
| GET | `/report/{session_id}` | Session summary, evaluations and full transcript |

## Notes

- Voice answers need microphone permission in the browser (localhost is fine).
- Only text-based PDFs are supported (no OCR for scanned documents).
- Sample files live in `backend/data/` for a quick demo.

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

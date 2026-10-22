# AI Interview Assistant — Study Notes

These notes explain the whole project in plain language: what it does, how a
request flows through it, what each file is for, and why I made the main
technical choices. Written so I can explain and defend the project out loud.

---

## 1. What the project does

An AI mock-interview app.

1. You upload a **resume** and a **job description** (or paste text).
2. The app generates **interview questions** tailored to that specific job.
3. It runs a **mock interview** — the interviewer asks one question at a time,
   you answer by **voice or typing**, and it gives short feedback.
4. It **grades** each answer (score + strengths + improvements) and shows a
   **report** with speaking stats.
5. Every interview is **saved**, so you can open **Past Interviews** and
   compare how you did across sessions.

**One-line pitch:** "Give it a resume and a job, and it interviews you for that
job, grades your answers, and tracks your progress over time."

---

## 2. The complete flow (follow this to explain the app)

```
Upload screen  ->  /ingest     ->  parsers.py -> embeddings.py -> chroma_store.py
                                  (file -> text -> vectors -> stored in Chroma)

Questions screen -> /questions ->  chains.py
                                  (pull resume/JD context from Chroma,
                                   send to Groq LLM, get JSON questions back)

Interview screen -> /interview ->  agent.py (+ transcribe.py for voice)
                                  (chat back and forth, one question at a time)

Interview screen -> /evaluate  ->  chains.py (grade) + voice.py (speaking stats)

Report screen   -> /report     ->  interview_store.py
                                  (rebuilt entirely from ChromaDB)

Past Interviews ->  /interviews -> interview_store.py list_sessions()
```

The short version to memorize: **upload -> embed & store -> retrieve & ask LLM
-> chat -> grade -> save -> show.**

---

## 3. Tech stack (and the single job each part does)

| Piece | What it is | Its job here |
|---|---|---|
| **FastAPI** | Python web framework | The backend server / API |
| **React + Vite + Tailwind** | Frontend tooling | The screens you click through |
| **LangChain** | LLM glue library | Connects prompts, models and the vector store |
| **Groq** | Free hosted LLM API | Runs the LLM (question writing + grading) and Whisper (voice-to-text) |
| **Hugging Face `all-MiniLM-L6-v2`** | Local embedding model | Turns text into vectors (runs on CPU, no API) |
| **ChromaDB** | Vector database | Stores text so we can search it by meaning |
| **Web Speech API** | Browser speech synthesis | Reads questions aloud |

---

## 4. File-by-file

### Backend (`backend/app/`)

- **`config.py`** — All the settings, read from `.env` with sensible defaults.
  Holds the Groq key, model names, chunk size and collection names. Every other
  file imports this, so there is one place to change a setting.

- **`parsers.py`** — Reads an uploaded file and returns plain text. Chooses the
  reader by extension: `pypdf` for PDF, `python-docx` for DOCX, plain decode for
  TXT/MD. Raises a clear error for unsupported types.

- **`embeddings.py`** — Loads the Hugging Face embedding model once (cached) and
  reuses it. This is the piece that turns any text into a list of numbers.

- **`chroma_store.py`** — The **resume/JD library**. `split_text` cuts documents
  into overlapping chunks. `add_documents` stores them. `retrieve` searches for
  the chunks closest in meaning to a question, optionally filtered to just the
  resume or just the JD. Collection name: `interview_context`.

- **`llm.py`** — Creates the Groq chat model (via LangChain). If the API key is
  missing it raises a clear error instead of failing strangely later.

- **`chains.py`** — The two LLM "recipes":
  - `generate_questions`: retrieve the most relevant resume + JD chunks, fill
    them into a prompt, ask the LLM, and parse the JSON list of questions.
  - `grade_answer`: ask the LLM to score an answer and return strengths,
    improvements and a model answer.
  - `_parse_json` tolerates the model wrapping JSON in markdown fences.

- **`agent.py`** — `InterviewAgent`: runs the actual conversation. It holds the
  planned questions plus the message history, greets the candidate, gives one
  line of feedback after each answer, and moves to the next question. `done`
  tells the app when the interview is over.

- **`transcribe.py`** — Sends recorded audio to Groq Whisper and returns the
  text. Writes the audio to a temp file first because the API needs a file.

- **`voice.py`** — `analyze(text, duration)` returns word count, words per
  minute, and how many filler words ("um", "like", ...) were used.

- **`sessions.py`** — Holds each interview **in memory** while it is happening
  (current question, transcript, evaluations). Fast but temporary — it does not
  survive a restart.

- **`interview_store.py`** — Saves finished interviews to ChromaDB so they DO
  survive a restart. Everything for one interview is tagged with its
  `session_id`. Record kinds: `question`, `answer`, `turn` (a chat line),
  `session` (the summary row with title + average score). `list_sessions()`
  powers the History page; `get_session()` rebuilds a full report.

- **`main.py`** — The API itself. Each function is one endpoint the frontend
  calls. Also: CORS (so the dev frontend can call it), session lookups, and a
  helper that keeps the session summary row up to date.

### Frontend (`frontend/src/`)

- **`main.jsx`** — Starts React and mounts `App`.
- **`index.css`** — Tailwind setup.
- **`api.js`** — One small function per backend endpoint. All calls go to
  `/api/...`, which Vite proxies to FastAPI (avoids CORS in development).
- **`App.jsx`** — The switchboard. Three screens (`wizard`, `history`, `view`)
  and the step state for the wizard: Upload -> Questions -> Interview -> Report.
- **`components/Stepper.jsx`** — The little numbered progress bar.
- **`steps/Upload.jsx`** — File pickers + text boxes; calls `/ingest`.
- **`steps/Questions.jsx`** — Calls `/questions` and shows the generated list.
- **`steps/Interview.jsx`** — The chat. Records audio with `MediaRecorder`,
  sends it to `/transcribe`, sends the answer to `/interview`, then `/evaluate`.
  Also reads replies aloud (sentence by sentence) and has a typing fallback.
- **`steps/Report.jsx`** — Score, per-question feedback, speaking stats and
  transcript.
- **`steps/History.jsx`** — Lists past interviews so you can compare scores.

---

## 5. Key technical decisions (the "why")

- **RAG instead of just asking the LLM.** Without context the LLM writes generic
  questions. RAG (retrieve relevant resume/JD text, then paste it into the
  prompt) makes the questions specific to the actual job and candidate.

- **ChromaDB for storage.** It is a lightweight, file-based vector store: no
  server or Docker to run, survives restarts, and handles both "search by
  meaning" (resume/JD) and simple record storage (past interviews).

- **Hugging Face embeddings, run locally.** The embedding model runs on CPU with
  no API key and no cost, and it keeps resumes off any external embedding
  service.

- **Groq as the LLM + speech provider.** It is free and fast, and gives us both
  a chat model and Whisper speech-to-text behind one key.

- **LangChain.** Just glue: it makes the "prompt -> model -> parse" and
  "vector store" steps compact and readable.

- **Two collections.** `interview_context` (searchable resume/JD chunks) is kept
  separate from `interviews` (saved sessions), so a report can be reloaded even
  after the in-memory session is gone.

- **FastAPI + React split.** The backend is a clean JSON API; the frontend is
  just a client of it. The Vite dev proxy handles routing so there are no CORS
  headaches during development.

- **Voice is optional.** Every step has a typed fallback, so the demo works even
  without a microphone.

---

## 6. Plain-language glossary

- **LLM** — the language model that writes text (Groq).
- **Embedding** — text turned into numbers so a computer can compare meaning.
- **Vector store** — a database of those numbers you can search by meaning.
- **RAG** — give the model relevant context before asking; an "open-book" answer.
- **Chunk** — a small slice of a document that gets stored and retrieved.
- **Agent** — here, the loop that holds the conversation and moves through the
  questions.

---

## 7. Likely questions and short answers

- **What is RAG?** Retrieval-Augmented Generation. I retrieve the most relevant
  resume/JD chunks from ChromaDB and put them in the prompt so the LLM tailors
  its questions instead of guessing.
- **Why a vector database?** I need to search documents by meaning, not exact
  words. ChromaDB stores the embeddings and finds the closest chunks fast.
- **Why Groq?** It is free and fast, and one key covers both the LLM and the
  speech-to-text.
- **Why Hugging Face for embeddings?** The model runs locally on CPU, so it is
  free, needs no key, and does not send resumes to another service.
- **How is the interview saved?** Every question, answer, chat turn and summary
  goes into the `interviews` collection, tagged with the session id, so reports
  and the History page work after a restart.
- **What limits does it have?** In-memory sessions are single-user; no auth;
  grading quality depends on the free model; the file store is local (not built
  for many users at once).

---

## 8. How to run it

Backend:
```
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload      # http://localhost:8000
```

Frontend:
```
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

Add your key to `backend/.env`: `GROQ_API_KEY=...` (free at console.groq.com).

# App settings. Values come from the .env file, otherwise we use the defaults below.

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _env(name: str, default: str = "") -> str:
    # Dashboard/UIs often keep a trailing newline or the quotes you pasted.
    # A key with a stray newline is sent as-is and rejected with 401.
    value = (os.getenv(name, default) or "").strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1].strip()
    return value


# Where the frontend build lives. We use the file location instead of the
# current folder so the app works no matter which folder uvicorn was started in.
BACKEND_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIST = Path(
    _env("FRONTEND_DIST", str(BACKEND_DIR.parent / "frontend" / "dist"))
).resolve()

# Hugging Face downloads the embedding model into this cache. We point it at a
# folder inside the project so the model can be downloaded once at build time
# and reused later without hitting the network again.
HF_HOME = _env("HF_HOME", str(BACKEND_DIR / ".hf_cache"))
os.environ.setdefault("HF_HOME", HF_HOME)

GROQ_API_KEY = _env("GROQ_API_KEY")
LLM_MODEL = _env("LLM_MODEL", "openai/gpt-oss-120b")
ASR_MODEL = _env("ASR_MODEL", "whisper-large-v3-turbo")
EMBEDDING_MODEL = _env("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
CHROMA_DIR = _env("CHROMA_DIR", "chroma_db")
CHUNK_SIZE = int(_env("CHUNK_SIZE", "800"))
CHUNK_OVERLAP = int(_env("CHUNK_OVERLAP", "100"))
COLLECTION_NAME = _env("COLLECTION_NAME", "interview_context")
INTERVIEW_COLLECTION = _env("INTERVIEW_COLLECTION", "interviews")

# Browser origins allowed to call the API. The defaults cover local development.
CORS_ORIGINS = [
    origin.strip()
    for origin in _env(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

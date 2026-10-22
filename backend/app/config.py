# App settings. Values come from the .env file, otherwise we use the defaults below.

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Where the frontend build lives. We use the file location instead of the
# current folder so the app works no matter which folder uvicorn was started in.
BACKEND_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIST = Path(
    os.getenv("FRONTEND_DIST", BACKEND_DIR.parent / "frontend" / "dist")
).resolve()

# Hugging Face downloads the embedding model into this cache. We point it at a
# folder inside the project so the model can be downloaded once at build time
# and reused later without hitting the network again.
HF_HOME = os.getenv("HF_HOME", str(BACKEND_DIR / ".hf_cache"))
os.environ.setdefault("HF_HOME", HF_HOME)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")
ASR_MODEL = os.getenv("ASR_MODEL", "whisper-large-v3-turbo")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
CHROMA_DIR = os.getenv("CHROMA_DIR", "chroma_db")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "800"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "interview_context")
INTERVIEW_COLLECTION = os.getenv("INTERVIEW_COLLECTION", "interviews")

# Browser origins allowed to call the API. The defaults cover local development.
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

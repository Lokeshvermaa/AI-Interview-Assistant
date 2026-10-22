# App settings. Values come from the .env file, otherwise we use the defaults below.

import os

from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")
ASR_MODEL = os.getenv("ASR_MODEL", "whisper-large-v3-turbo")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
CHROMA_DIR = os.getenv("CHROMA_DIR", "chroma_db")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "800"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "interview_context")
INTERVIEW_COLLECTION = os.getenv("INTERVIEW_COLLECTION", "interviews")

"""Loads the Hugging Face model that turns text into vectors (embeddings).

It runs locally on CPU, so we only load it once and reuse it.
"""

import threading

# config sets HF_HOME, which tells Hugging Face where to keep the model files.
# It has to be imported before huggingface_hub, so it comes first on purpose.
from . import config
from langchain_huggingface import HuggingFaceEmbeddings

_lock = threading.Lock()
_embeddings: HuggingFaceEmbeddings | None = None


def get_embeddings() -> HuggingFaceEmbeddings:
    # Loading torch and the model takes a few seconds, so two requests arriving
    # together must not both load it.
    global _embeddings
    if _embeddings is None:
        with _lock:
            if _embeddings is None:
                _embeddings = HuggingFaceEmbeddings(
                    model_name=config.EMBEDDING_MODEL,
                    model_kwargs={"device": "cpu"},
                    encode_kwargs={"normalize_embeddings": True},
                )
    return _embeddings

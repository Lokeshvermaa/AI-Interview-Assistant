"""Loads the Hugging Face model that turns text into vectors (embeddings).

It runs locally on CPU, so we only load it once and reuse it.
"""

from functools import lru_cache

# config sets HF_HOME, which tells Hugging Face where to keep the model files.
# It has to be imported before huggingface_hub, so it comes first on purpose.
from . import config
from langchain_huggingface import HuggingFaceEmbeddings


@lru_cache(maxsize=1)
def get_embeddings() -> HuggingFaceEmbeddings:
    return HuggingFaceEmbeddings(
        model_name=config.EMBEDDING_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )

"""Loads the Hugging Face model that turns text into vectors (embeddings).

It runs locally on CPU, so we only load it once and reuse it.
"""

from functools import lru_cache

from langchain_huggingface import HuggingFaceEmbeddings

from . import config


@lru_cache(maxsize=1)
def get_embeddings() -> HuggingFaceEmbeddings:
    return HuggingFaceEmbeddings(
        model_name=config.EMBEDDING_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )

"""Stores the resume and job description in ChromaDB and searches them later.

Text is split into chunks, each chunk is turned into a vector by the embedding
model, and Chroma keeps them so we can search by meaning.
"""

import threading

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from . import config
from .chroma_client import get_client
from .embeddings import get_embeddings

_lock = threading.Lock()
_store: Chroma | None = None


def get_store() -> Chroma:
    # Both requests and the report code call this, so build it only once.
    global _store
    if _store is None:
        with _lock:
            if _store is None:
                _store = Chroma(
                    client=get_client(),
                    collection_name=config.COLLECTION_NAME,
                    embedding_function=get_embeddings(),
                )
    return _store


def split_text(text: str, source: str) -> list[Document]:
    # Cut big documents into overlapping chunks so retrieval stays accurate.
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=config.CHUNK_SIZE,
        chunk_overlap=config.CHUNK_OVERLAP,
    )
    return splitter.create_documents([text], metadatas=[{"source": source}])


def add_documents(docs: list[Document]) -> int:
    if not docs:
        return 0
    get_store().add_documents(docs)
    return len(docs)


def retrieve(query: str, k: int = 4, source: str | None = None) -> list[Document]:
    # Find the k chunks closest in meaning to the query. Optional source filter
    # lets us search only the resume or only the job description.
    query = (query or "").strip() or "interview"
    where = {"source": source} if source else None
    return get_store().similarity_search(query, k=k, filter=where)


def reset() -> None:
    global _store
    with _lock:
        if _store is not None:
            _store.delete_collection()
        _store = None

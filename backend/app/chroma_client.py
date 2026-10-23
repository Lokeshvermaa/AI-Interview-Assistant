"""One shared ChromaDB client for the whole app.

Chroma keeps a process-wide registry of open databases keyed by the storage
path. Building a second client for the same folder while another request is
starting can corrupt that registry, which shows up as ``KeyError: 'chroma_db'``.
We create a single client once, under a lock, and hand it to both collections.
"""

import os
import threading

import chromadb
from chromadb.config import Settings

from . import config

_lock = threading.Lock()
_client = None


def get_client():
    global _client
    if _client is None:
        with _lock:
            if _client is None:
                _client = chromadb.PersistentClient(
                    # Absolute so the identifier stays stable no matter the cwd.
                    path=os.path.abspath(config.CHROMA_DIR),
                    # Telemetry would add a network call during the first request.
                    settings=Settings(anonymized_telemetry=False),
                )
    return _client

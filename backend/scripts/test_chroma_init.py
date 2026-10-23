"""Regression test for ChromaDB startup.

Reproduces the production failure where two requests start the two Chroma
collections at the same time. Before the fix, that race could release the
shared system and make the next call fail with ``KeyError: 'chroma_db'``.

Usage:
    python scripts/test_chroma_init.py
"""

import os
import sys
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

TMP = tempfile.mkdtemp(prefix="chroma-init-test-")
# Must be set before app.config is imported.
os.environ["CHROMA_DIR"] = os.path.join(TMP, "chroma_db")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from chromadb.api.shared_system_client import SharedSystemClient  # noqa: E402

from app import chroma_store, interview_store  # noqa: E402

passed = 0
failed = 0


def check(label: str, ok: bool, extra: str = "") -> None:
    global passed, failed
    if ok:
        passed += 1
        print(f"  PASS  {label}{(' - ' + extra) if extra else ''}")
    else:
        failed += 1
        print(f"  FAIL  {label}{(' - ' + extra) if extra else ''}")


def main() -> None:
    print(f"Chroma init test (data dir: {TMP})\n")

    barrier = threading.Barrier(6)

    def open_both(_: int) -> None:
        # Simulates several requests hitting the app before anything is cached.
        barrier.wait()
        chroma_store.get_store()
        interview_store.get_collection()

    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(open_both, i) for i in range(6)]
        errors = [str(f.exception()) for f in futures if f.exception()]

    check("6 concurrent callers initialise both collections", not errors, "; ".join(errors))
    check(
        "only one Chroma system is registered",
        len(SharedSystemClient._identifier_to_system) == 1,
        str(list(SharedSystemClient._identifier_to_system)),
    )

    store = chroma_store.get_store()
    context = interview_store.get_collection()

    check("context collection is usable", store._collection.count() == 0)

    context.add_texts(
        ["first answer"],
        ids=["s1-q0"],
        metadatas=[{"session_id": "s1", "kind": "answer", "index": 0}],
    )
    context.add_texts(
        ["second answer"],
        ids=["s2-q0"],
        metadatas=[{"session_id": "s2", "kind": "answer", "index": 0}],
    )
    check("writes work on the interview collection", context.get(where={"session_id": "s1"})["ids"] == ["s1-q0"])

    s1 = interview_store.get_session("s1")
    s2 = interview_store.get_session("s2")
    check("session isolation: s1 sees only its own answer", [a["answer"] for a in s1["answers"]] == ["first answer"])
    check("session isolation: s2 sees only its own answer", [a["answer"] for a in s2["answers"]] == ["second answer"])

    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

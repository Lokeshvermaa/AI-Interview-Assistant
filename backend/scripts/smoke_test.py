"""End-to-end check against a running server.

Usage:
    python scripts/smoke_test.py                       # local server on port 8000
    python scripts/smoke_test.py https://your-app.onrender.com

Walks the whole flow: health -> ingest -> questions -> interview -> evaluate
-> report -> past interviews. Exits with code 1 if anything fails, so it can be
used as a post-deploy check.
"""

import sys
from pathlib import Path

import httpx

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

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
    global passed, failed

    resume = (DATA_DIR / "sample_resume.txt").read_text()
    jd = (DATA_DIR / "sample_jd.txt").read_text()

    print(f"Smoke test against {BASE}\n")

    with httpx.Client(base_url=BASE, timeout=180.0) as client:
        print("Health")
        for path in ("/health", "/api/health"):
            res = client.get(path)
            check(f"GET {path}", res.status_code == 200, res.text[:60])

        print("\nIngest")
        res = client.post(
            "/api/ingest", data={"resume_text": resume, "jd_text": jd}
        )
        check("POST /api/ingest", res.status_code == 200, res.text[:120])
        if res.status_code != 200:
            return
        session_id = res.json()["session_id"]
        check("session id returned", bool(session_id), session_id)

        print("\nQuestions")
        res = client.post(
            "/api/questions", json={"session_id": session_id, "n": 3}
        )
        check("POST /api/questions", res.status_code == 200, res.text[:120])
        if res.status_code != 200:
            return
        questions = res.json()["questions"]
        check("3 questions generated", len(questions) == 3, f"got {len(questions)}")
        check(
            "questions have text",
            all(q.get("question") for q in questions),
        )

        print("\nInterview")
        res = client.post("/api/interview", json={"session_id": session_id, "message": ""})
        check("POST /api/interview (start)", res.status_code == 200, res.text[:120])
        if res.status_code == 200:
            check("interviewer greeted", bool(res.json().get("reply")))

        answer = (
            "I built a FastAPI service with a RAG pipeline. I chunked the documents, "
            "embedded them with a sentence-transformers model and stored the vectors "
            "in ChromaDB, then retrieved the top chunks to ground the LLM prompt."
        )
        res = client.post(
            "/api/interview", json={"session_id": session_id, "message": answer}
        )
        check("POST /api/interview (answer)", res.status_code == 200, res.text[:120])
        if res.status_code == 200:
            check("interviewer replied", bool(res.json().get("reply")))

        print("\nEvaluate")
        question = questions[0]["question"] if questions else "Tell me about yourself."
        res = client.post(
            "/api/evaluate",
            json={
                "session_id": session_id,
                "question": question,
                "answer": answer,
                "duration_sec": 18.0,
            },
        )
        check("POST /api/evaluate", res.status_code == 200, res.text[:120])
        if res.status_code == 200:
            body = res.json()
            check("score returned", isinstance(body.get("score"), int), str(body.get("score")))
            check("voice metrics returned", body.get("voice", {}).get("wpm") is not None)

        print("\nReport")
        res = client.get(f"/api/report/{session_id}")
        check("GET /api/report/{id}", res.status_code == 200, res.text[:120])
        if res.status_code == 200:
            body = res.json()
            check("report has questions", body.get("questions_asked", 0) >= 3)
            check("report has an evaluation", body.get("answers_evaluated", 0) >= 1)
            check("report has a transcript", len(body.get("transcript") or []) >= 2)

        res = client.get("/api/interviews")
        check("GET /api/interviews", res.status_code == 200, res.text[:120])
        if res.status_code == 200:
            check("session listed", res.json()["count"] >= 1)

        print("\nSession isolation")
        res = client.get("/api/report/does-not-exist")
        check(
            "unknown session returns 404",
            res.status_code == 404,
            f"got {res.status_code}",
        )

        print("\nFrontend")
        res = client.get("/")
        check("GET / serves the app", res.status_code == 200, f"status {res.status_code}")
        if res.status_code == 200 and "text/html" in res.headers.get("content-type", ""):
            check("index.html returned", "<div id=\"root\"" in res.text or "<script" in res.text)

    print(f"\n{passed} passed, {failed} failed")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()

"""The two LLM prompts: one to create questions, one to grade an answer.

Both follow the same RAG pattern: pull the most relevant chunks from ChromaDB
first, then paste them into the prompt so the model has real context to use.
"""

import json
import re

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from .chroma_store import retrieve
from .llm import get_llm

QUESTION_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an experienced technical interviewer. Generate interview "
            "questions tailored to the candidate's résumé and the job description. "
            "Keep every question SHORT: one sentence, at most 20 words, asking one "
            "thing only (no multi-part or compound questions). "
            "Return ONLY a JSON array of objects with keys: "
            '"question" (string), "type" (one of: technical, behavioral, '
            '"resume-specific", "role-fit"), "difficulty" (easy|medium|hard). '
            "No prose, no markdown fences.",
        ),
        (
            "human",
            "Job description context:\n{jd_context}\n\n"
            "Candidate résumé context:\n{resume_context}\n\n"
            "Generate exactly {n} questions.",
        ),
    ]
)

GRADE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a fair, expert interview evaluator. Grade the candidate's "
            "answer to the interview question. You may use the reference context if "
            "relevant. Return ONLY a JSON object with keys: "
            '"score" (integer 0-10), "verdict" (short string), '
            '"strengths" (array of short strings), '
            '"improvements" (array of short strings), '
            '"model_answer" (a concise ideal answer). No markdown fences.',
        ),
        (
            "human",
            "Question:\n{question}\n\n"
            "Reference context:\n{context}\n\n"
            "Candidate answer:\n{answer}",
        ),
    ]
)

_chat_parser = StrOutputParser()


def _parse_json(raw: str):
    # The model usually returns clean JSON, but sometimes wraps it in ```json.
    # Strip those and try again before giving up.
    text = (raw or "").strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"[\[{].*[\]}]", text, flags=re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


def _context(query: str, source: str | None, k: int) -> str:
    # Grab the k most relevant chunks and join them into one string for the prompt.
    docs = retrieve(query, k=k, source=source)
    return "\n\n".join(doc.page_content for doc in docs) or "(none available)"


def generate_questions(
    jd_text: str, resume_text: str, n: int = 5
) -> list[dict]:
    jd_context = _context(jd_text or "job description", source="jd", k=4)
    resume_context = _context(resume_text or "candidate résumé", source="resume", k=4)

    chain = QUESTION_PROMPT | get_llm(temperature=0.5) | _chat_parser
    raw = chain.invoke(
        {"jd_context": jd_context, "resume_context": resume_context, "n": n}
    )
    data = _parse_json(raw)
    if isinstance(data, dict):
        data = data.get("questions", [])
    return data[:n]


def grade_answer(question: str, answer: str) -> dict:
    context = _context(question, source=None, k=4)
    chain = GRADE_PROMPT | get_llm(temperature=0.2) | _chat_parser
    raw = chain.invoke({"question": question, "context": context, "answer": answer})
    data = _parse_json(raw)
    data.setdefault("score", 0)
    data.setdefault("strengths", [])
    data.setdefault("improvements", [])
    return data

"""Checks the config cleanup and the LLM error reporting added for the
'Generate Questions' 500 (Groq 401 Invalid API Key).

Usage:
    python scripts/test_llm_errors.py
"""

import os
import sys
from pathlib import Path

# Values pasted into a dashboard often keep quotes or a trailing newline.
os.environ["GROQ_API_KEY"] = '  "gsk_test_key"\n'
os.environ["LLM_MODEL"] = " openai/gpt-oss-120b \n"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import chains, config, llm  # noqa: E402

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


def raise_named(name: str) -> Exception:
    return type(name, (Exception,), {})("boom")


def main() -> None:
    print("LLM config/error test\n")

    check("API key has quotes and whitespace stripped", config.GROQ_API_KEY == "gsk_test_key", config.GROQ_API_KEY)
    check("model name is stripped", config.LLM_MODEL == "openai/gpt-oss-120b", config.LLM_MODEL)

    llm.get_llm.cache_clear()
    check("valid-looking key builds the client", llm.get_llm() is not None)

    for name in ("AuthenticationError", "PermissionDeniedError"):
        message = llm.error_message(raise_named(name))
        check(f"{name} explains the API key problem", "GROQ_API_KEY" in message, message)

    check(
        "rate limits get a retry hint",
        "rate-limiting" in llm.error_message(raise_named("RateLimitError")),
    )
    check(
        "connection errors are readable",
        "Could not reach" in llm.error_message(raise_named("APIConnectionError")),
    )

    check(
        "fenced JSON is parsed",
        chains._parse_json('```json\n[{"question": "x"}]\n```') == [{"question": "x"}],
    )
    check(
        "JSON surrounded by prose is parsed",
        chains._parse_json('Sure: [{"question": "x"}] hope that helps') == [{"question": "x"}],
    )

    try:
        chains._parse_json("")
    except RuntimeError as exc:
        check("empty response raises a readable error", "not valid JSON" in str(exc), str(exc))
    else:
        check("empty response raises a readable error", False)

    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

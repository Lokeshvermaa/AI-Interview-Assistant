"""Creates the Groq chat model. This is the LLM that writes the questions and grades answers."""

from functools import lru_cache

from langchain_groq import ChatGroq

from . import config


def error_message(exc: Exception) -> str:
    """Turn a provider error into something the UI can show."""
    name = type(exc).__name__
    if name in {"AuthenticationError", "PermissionDeniedError"}:
        return (
            "Groq rejected the API key. Set a valid GROQ_API_KEY on the server "
            "(https://console.groq.com/keys), then restart the service."
        )
    if name == "RateLimitError":
        return "Groq is rate-limiting requests. Please try again in a moment."
    if name in {"APIConnectionError", "APITimeoutError"}:
        return "Could not reach Groq. Please try again."
    return f"Groq request failed ({name}): {exc}"


@lru_cache(maxsize=4)
def get_llm(temperature: float = 0.3) -> ChatGroq:
    if not config.GROQ_API_KEY:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Copy backend/.env.example to backend/.env "
            "and add your free key from https://console.groq.com/keys"
        )
    if not config.GROQ_API_KEY.startswith("gsk_"):
        raise RuntimeError(
            "GROQ_API_KEY looks invalid (a Groq key starts with 'gsk_'). "
            "Check the value set on the server."
        )
    return ChatGroq(
        api_key=config.GROQ_API_KEY,
        model=config.LLM_MODEL,
        temperature=temperature,
    )

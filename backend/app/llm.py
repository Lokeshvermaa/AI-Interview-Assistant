"""Creates the Groq chat model. This is the LLM that writes the questions and grades answers."""

from functools import lru_cache

from langchain_groq import ChatGroq

from . import config


@lru_cache(maxsize=4)
def get_llm(temperature: float = 0.3) -> ChatGroq:
    if not config.GROQ_API_KEY:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Copy backend/.env.example to backend/.env "
            "and add your free key from https://console.groq.com/keys"
        )
    return ChatGroq(
        api_key=config.GROQ_API_KEY,
        model=config.LLM_MODEL,
        temperature=temperature,
    )

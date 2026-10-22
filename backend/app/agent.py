"""Runs the interview chat. It keeps the whole conversation in memory so the
model can see what was already said and move on to the next question."""

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from .llm import get_llm

SYSTEM = (
    "You are a friendly but professional interviewer conducting a mock interview. "
    "Follow this plan strictly:\n"
    "1. Greet the candidate in one short sentence and ask the FIRST question.\n"
    "2. After each candidate answer, give ONE short sentence of feedback, then ask "
    "the NEXT planned question.\n"
    "3. When all planned questions are answered, thank the candidate and say the "
    "interview is complete.\n"
    "Keep replies short and spoken-friendly. Ask exactly one question at a time, and "
    "keep each question to a single short sentence (max 20 words).\n\n"
    "Planned questions:\n{questions}"
)


class InterviewAgent:
    def __init__(self, questions: list[str]):
        self.questions = questions or ["Tell me about yourself."]
        self.index = 0
        self.messages = [
            SystemMessage(content=SYSTEM.format(questions=_numbered(self.questions)))
        ]
        self._llm = get_llm(temperature=0.4)

    @property
    def done(self) -> bool:
        return self.index >= len(self.questions)

    def start(self) -> str:
        reply = self._invoke()
        self.messages.append(AIMessage(content=reply))
        return reply

    def respond(self, user_message: str) -> str:
        self.messages.append(HumanMessage(content=user_message))
        if self.index < len(self.questions):
            self.index += 1
        reply = self._invoke()
        self.messages.append(AIMessage(content=reply))
        return reply

    def _invoke(self) -> str:
        return self._llm.invoke(self.messages).content


def _numbered(questions: list[str]) -> str:
    return "\n".join(f"{i + 1}. {q}" for i, q in enumerate(questions))

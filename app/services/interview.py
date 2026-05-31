from dataclasses import dataclass, field

from app.services.llm import llm_service
from app.services.prompts import INTERVIEW_FEEDBACK_PROMPT, INTERVIEW_QUESTION_PROMPT


@dataclass
class InterviewSession:
    topic: str
    current_question: str | None = None
    question_number: int = 0
    history: list[dict[str, str]] = field(default_factory=list)


class InterviewManager:
    def __init__(self) -> None:
        self.sessions: dict[str, InterviewSession] = {}

    def reset(self, session_id: str, topic: str) -> InterviewSession:
        session = InterviewSession(topic=topic)
        self.sessions[session_id] = session
        return session

    def get(self, session_id: str, topic: str) -> InterviewSession:
        if session_id not in self.sessions:
            return self.reset(session_id, topic)
        return self.sessions[session_id]

    def handle(
        self,
        session_id: str,
        topic: str,
        answer: str | None,
        reset: bool = False,
        provider: str = "offline",
    ) -> dict[str, object]:
        session = self.reset(session_id, topic) if reset else self.get(session_id, topic)

        if answer:
            ans_lower = answer.lower().strip()
            stop_keywords = ["stop", "exit", "quit", "leave", "end interview", "leave that", "leave this"]
            if any(ans_lower.startswith(k) for k in stop_keywords):
                return {
                    "session_id": session_id,
                    "question_number": session.question_number,
                    "question": "Interview ended by user.",
                    "feedback": None,
                    "finished": True,
                }

        feedback = None
        if session.current_question and answer and answer.strip():
            feedback = llm_service.generate(
                INTERVIEW_FEEDBACK_PROMPT.format(
                    question=session.current_question,
                    answer=answer.strip(),
                ),
                provider=provider,
            )
            session.history.append(
                {
                    "question": session.current_question,
                    "answer": answer.strip(),
                    "feedback": feedback,
                }
            )

        next_question = llm_service.generate(
            INTERVIEW_QUESTION_PROMPT.format(topic=session.topic),
            provider=provider,
        ).strip()
        session.current_question = next_question
        session.question_number += 1

        return {
            "session_id": session_id,
            "question_number": session.question_number,
            "question": next_question,
            "feedback": feedback,
            "finished": False,
        }


interview_manager = InterviewManager()

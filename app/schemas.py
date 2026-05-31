from pydantic import BaseModel, Field


class ChatHistoryMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: str | None = Field(default="default")
    provider: str = Field(default="offline", pattern="^(offline|online)$")
    history: list[ChatHistoryMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    intent: str
    reply: str


class InterviewRequest(BaseModel):
    message: str | None = None
    topic: str | None = "software engineering"
    session_id: str = "default"
    reset: bool = False
    provider: str = Field(default="offline", pattern="^(offline|online)$")


class InterviewResponse(BaseModel):
    session_id: str
    question_number: int
    question: str
    feedback: str | None = None
    finished: bool = False


class ResumeAnalysisResponse(BaseModel):
    filename: str | None = None
    analysis: str
    extracted_text: str

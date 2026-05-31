from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.schemas import ChatRequest, ChatResponse, InterviewRequest, InterviewResponse, ResumeAnalysisResponse
from app.services.llm import llm_service
from app.services.intent import Intent, detect_intent
from app.services.interview import interview_manager
from app.services.prompts import build_chat_prompt
from app.services.resume import analyze_resume


settings = get_settings()

app = FastAPI(
    title="AI Engineering Assistant",
    description="Gemini-powered assistant for DSA, core subjects, resume analysis, and interview practice.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


from app.services.memory import memory_db

@app.post("/chat", response_model=ChatResponse)
async def chat(data: ChatRequest) -> ChatResponse:
    try:
        intent = detect_intent(data.message)
        if intent == Intent.INTERVIEW:
            reply = (
                "Interview mode is ready. Use the Interview tab or POST to /interview. "
                "I will ask one question at a time, evaluate your answer, then continue."
            )
            return ChatResponse(intent=intent.value, reply=reply)

        memory_context = memory_db.search_memory(data.message)
        chat_history = [item.model_dump() for item in data.history]
        prompt = build_chat_prompt(intent, data.message, memory_context, chat_history)
        reply = llm_service.generate(
            prompt,
            use_search=intent == Intent.GENERAL,
            provider=data.provider,
        )
        
        # Save interaction to memory
        memory_db.add_memory(f"User: {data.message}\nLumina: {reply}")
        
        return ChatResponse(intent=intent.value, reply=reply)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/resume", response_model=ResumeAnalysisResponse)
async def resume(
    file: UploadFile | None = File(default=None),
    text: str | None = Form(default=None),
    provider: str = Form(default="offline"),
) -> ResumeAnalysisResponse:
    try:
        filename, analysis, extracted_text = await analyze_resume(file, text, provider)
        return ResumeAnalysisResponse(filename=filename, analysis=analysis, extracted_text=extracted_text)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/interview", response_model=InterviewResponse)
async def interview(data: InterviewRequest) -> InterviewResponse:
    try:
        result = interview_manager.handle(
            session_id=data.session_id,
            topic=data.topic or "software engineering",
            answer=data.message,
            reset=data.reset,
            provider=data.provider,
        )
        return InterviewResponse(**result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


try:
    app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")
except RuntimeError:
    pass

from io import BytesIO

from fastapi import HTTPException, UploadFile

from app.services.llm import llm_service
from app.services.prompts import RESUME_ANALYZER_PROMPT


async def extract_resume_text(file: UploadFile | None, text: str | None) -> tuple[str | None, str]:
    if text and text.strip():
        return None, text.strip()

    if file is None:
        raise HTTPException(status_code=400, detail="Upload a PDF/TXT resume or provide resume text.")

    filename = file.filename or "resume"
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded resume is empty.")

    lowered = filename.lower()
    if lowered.endswith(".txt"):
        return filename, content.decode("utf-8", errors="ignore").strip()

    if lowered.endswith(".pdf"):
        return filename, _extract_pdf_text(content)

    raise HTTPException(status_code=400, detail="Only PDF and TXT resumes are supported.")


def _extract_pdf_text(content: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="PDF support requires pypdf. Install dependencies from requirements.txt.",
        ) from exc

    try:
        reader = PdfReader(BytesIO(content))
        pages = [page.extract_text() or "" for page in reader.pages]
        extracted = "\n".join(pages).strip()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read PDF resume: {exc}") from exc

    if not extracted:
        raise HTTPException(
            status_code=400,
            detail="No readable text found in the PDF. Try uploading a text-based PDF or paste the resume text.",
        )
    return extracted


async def analyze_resume(
    file: UploadFile | None,
    text: str | None,
    provider: str = "offline",
) -> tuple[str | None, str, str]:
    filename, resume_text = await extract_resume_text(file, text)
    prompt = f"{RESUME_ANALYZER_PROMPT}\n{resume_text}"
    return filename, llm_service.generate(prompt, provider=provider), resume_text

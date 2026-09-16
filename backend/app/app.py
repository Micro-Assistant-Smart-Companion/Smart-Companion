from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")
 
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from app.models import TextInput, RedactOutput, TaskRequest, TaskResponse, TranscribeResponse, DetectObjectsResponse, CaptionResponse, GuidanceResponse
from app.redact import redact_text
from app.llm import decompose_task
from visual.vision import detect_objects_summary
from visual.caption import answer_about_image
from visual.guide import get_guidance
from speech_to_text.speech import transcribe_audio_bytes
app = FastAPI(title="Smart Companion API")

@app.get("/health")
def health():
    return{"status" : "OK"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_methods=["*"],
    allow_headers=["*"],
)
 
@app.post("/redact", response_model=RedactOutput)
def redact_pii(input: TextInput):
    redacted = redact_text(input.text)
    return {"redacted_text": redacted}

@app.post("/decompose-task", response_model=TaskResponse)
def decompose(req: TaskRequest):
    safe_goal = redact_text(req.goal)

    result = decompose_task(
        goal=safe_goal,
        reading_level=req.reading_level,
        max_steps=req.max_steps,
        tone=req.tone,
        completed_steps=req.completed_steps,
        history=[t.model_dump() for t in req.history],
    )

    return result

@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(file: UploadFile = File(...)):
    audio_bytes = await file.read()
    text = transcribe_audio_bytes(audio_bytes, filename=file.filename, content_type=file.content_type)
    return {"text": text}

@app.post("/detect-objects", response_model=DetectObjectsResponse)
async def detect_objects(file: UploadFile = File(...)):
    image_bytes = await file.read()
    summary = detect_objects_summary(image_bytes)
    return {"summary": summary}

@app.post("/caption-image", response_model=CaptionResponse)
async def caption_image(file: UploadFile = File(...), question: str = Form(...)):
    image_bytes = await file.read()
    safe_question = redact_text(question)  # in case the question itself contains personal info
    return answer_about_image(image_bytes, safe_question)

@app.post("/guide-search", response_model=GuidanceResponse)
async def guide_search(file: UploadFile = File(...), target: str = Form(...)):
    image_bytes = await file.read()
    safe_target = redact_text(target)
    return get_guidance(image_bytes, safe_target)
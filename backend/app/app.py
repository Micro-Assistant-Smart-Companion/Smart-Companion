from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")
 
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from app.models import TextInput, RedactOutput, TaskRequest, TaskResponse, TranscribeResponse
from app.redact import redact_text
from app.llm import decompose_task
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
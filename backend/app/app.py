from pathlib import Path
import os
import time
import asyncio
from dotenv import load_dotenv
from pydantic import BaseModel
import json

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")
 
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import StreamingResponse, Response
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from app.models import (
    TextInput,
    RedactOutput,
    TaskRequest,
    TaskResponse,
    TranscribeResponse,
    DetectObjectsResponse,
    CaptionResponse,
    GuidanceResponse,
    CameraConfig, CameraStatusResponse,
    DocumentUploadResponse, DocumentQuestionRequest, DocumentAnswerResponse
)
# pyrefly: ignore [missing-import]
from app.redact import redact_text
# pyrefly: ignore [missing-import]
from app.llm import decompose_task
from visual.vision import detect_objects_summary
from visual.caption import answer_about_image
from visual.guide import get_guidance
from visual.ip_camera import IPCameraStream
from speech_to_text.speech import transcribe_audio_bytes
from visual.pdfqa import extract_pages, store_document, answer_question_about_document, prefetch_pending_pages
from app.router import classify_intent, build_agent_system_note

app = FastAPI(title="Smart Companion API")

CAMERA_URL = os.getenv("CAMERA_URL", "http://192.168.31.195:8080/video")
camera = IPCameraStream(CAMERA_URL)
camera.start()

@app.get("/health")
def health():
    return {"status": "OK"}

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
        session_note=req.session_note,
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
async def caption_image(file: UploadFile = File(...), question: str = Form(...), history: str = Form(default="[]")):
    image_bytes = await file.read()
    safe_question = redact_text(question)  # in case the question itself contains personal info
    try:
        history_list = json.loads(history)
    except (ValueError, TypeError):
        history_list = []
    return answer_about_image(image_bytes, safe_question, history_list)

@app.post("/guide-search", response_model=GuidanceResponse)
async def guide_search(file: UploadFile = File(...), target: str = Form(...)):
    image_bytes = await file.read()
    safe_target = redact_text(target)
    return get_guidance(image_bytes, safe_target)

# --- IP Camera Endpoints integrated with frontend settings ---

@app.post("/upload-document", response_model=DocumentUploadResponse)
async def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    file_bytes = await file.read()
    page_texts, page_count = extract_pages(file_bytes)
    result = store_document(file.filename, file_bytes, page_texts)
    result["page_count"] = page_count

    if result["pages_pending_vision"] > 0:
        # Start reading scanned pages now, in the background, instead of
        # waiting for a question to trigger it - by the time the user
        # finishes typing, some or all pages may already be read.
        background_tasks.add_task(prefetch_pending_pages, result["document_id"])

    return result

@app.post("/ask-document", response_model=DocumentAnswerResponse)
def ask_document(req: DocumentQuestionRequest):
    safe_question = redact_text(req.question)
    return answer_question_about_document(req.document_id, safe_question)

@app.get("/camera/status", response_model=CameraStatusResponse)
def camera_status():
    return camera.get_status()

@app.post("/camera/set-url", response_model=CameraStatusResponse)
def camera_set_url(config: CameraConfig):
    camera.set_url(config.url)
    # Give the background thread a brief moment to attempt connection
    time.sleep(0.3)
    return camera.get_status()

@app.get("/camera/stream")
async def camera_stream():
    async def generate():
        try:
            while True:
                frame_bytes = camera.get_latest_jpeg()
                if frame_bytes:
                    yield (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
                    )
                    await asyncio.sleep(0.04)  # ~25 FPS
                else:
                    await asyncio.sleep(0.2)  # Reduce CPU usage when camera is offline
        except (GeneratorExit, asyncio.CancelledError):
            pass

    return StreamingResponse(generate(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/camera/frame")
def camera_frame():
    frame_bytes = camera.get_latest_jpeg()
    if not frame_bytes:
        return Response(status_code=503, content="Camera frame not available")
    return Response(
        content=frame_bytes,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache"},
    )

@app.post("/camera/ask")
def ask_ip_camera(question: str = Form(...), history: str = Form(default="[]")):
    frame_bytes = camera.get_latest_jpeg()
    if not frame_bytes:
        return {"error": "Camera frame not available. Please check that your IP Webcam stream is active."}
 
    safe_question = redact_text(question)
    try:
        history_list = json.loads(history)
    except (ValueError, TypeError):
        history_list = []
    return answer_about_image(frame_bytes, safe_question, history_list)

@app.get("/camera/detect-objects", response_model=DetectObjectsResponse)
def detect_objects_ip_camera():
    frame_bytes = camera.get_latest_jpeg()
    if not frame_bytes:
        return {"summary": "Camera frame not available. Please check that your IP Webcam stream is active."}
    return {"summary": detect_objects_summary(frame_bytes)}

@app.post("/camera/guide-search", response_model=GuidanceResponse)
def guide_search_ip_camera(target: str = Form(...)):
    frame_bytes = camera.get_latest_jpeg()
    if not frame_bytes:
        return {"found": False, "guidance": "Camera frame not available. Check your IP stream."}
    safe_target = redact_text(target)
    return get_guidance(frame_bytes, safe_target)

@app.post("/classify-session")
def classify_session(input: TextInput):
    label = classify_intent(input.text)
    return {"label": label, "note": build_agent_system_note(label)}
from fastapi import FastAPI
from dotenv import load_dotenv
load_dotenv()

from app.models import TextInput, RedactOutput, TaskRequest, TaskResponse
from app.redact import redact_text
from app.llm import decompose_task

app = FastAPI(title="Smart Companion API")

@app.get("/health")
def health():
    return{"status" : "OK"}

@app.post("/redact", response_model=RedactOutput)
def redact_pii(input: TextInput):
    redacted = redact_text(input.text)
    return {"redacted_text": redacted}

@app.post("/decompose-task", response_model=TaskResponse)
def decompose(req: TaskRequest):
    safe_goal = redact_text(req.goal)
 
    steps = decompose_task(
        goal=safe_goal,
        reading_level=req.reading_level,
        max_steps=req.max_steps,
        tone=req.tone,
    )
 
    return {"steps": steps}

from pydantic import BaseModel


class TextInput(BaseModel):
    text: str


class RedactOutput(BaseModel):
    redacted_text: str


class ChatTurn(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class TaskRequest(BaseModel):
    goal: str
    reading_level: str = "simple"
    max_steps: int = 3
    tone: str = "encouraging"
    completed_steps: list = []
    history: list[ChatTurn] = []


class TaskResponse(BaseModel):
    steps: list
    is_final: bool = False
    was_error: bool = False


class TranscribeResponse(BaseModel):
    text: str


class DetectObjectsResponse(BaseModel):
    summary: str


class CaptionResponse(BaseModel):
    headline: str
    detail: str = ""


class GuidanceResponse(BaseModel):
    found: bool
    guidance: str
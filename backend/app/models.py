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
    steps: list[str] = []


class GuidanceResponse(BaseModel):
    found: bool
    guidance: str


class CameraConfig(BaseModel):
    url: str


class CameraStatusResponse(BaseModel):
    connected: bool
    url: str
    last_frame_age_seconds: float | None = None
    message: str = ""
    
class DocumentUploadResponse(BaseModel):
    document_id: str
    filename: str
    word_count: int
    truncated: bool
    preview: str
    page_count: int = 0
    pages_pending_vision: int = 0


class DocumentQuestionRequest(BaseModel):
    document_id: str
    question: str


class DocumentAnswerResponse(BaseModel):
    headline: str
    detail: str = ""
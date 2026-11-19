from typing import Optional, List
from pydantic import BaseModel


class TextInput(BaseModel):
    text: str


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
    session_note: str = ""
    language: str = "en"          # "en" | "hi" | "bn"
    health_context: str = ""      # the user's own Health Log summary (medical chats only)
    followup: bool = False        # the page thinks this is a question about the earlier steps


class TaskResponse(BaseModel):
    steps: list
    is_final: bool = False
    was_error: bool = False
    is_emergency: bool = False
    is_crisis: bool = False
    is_followup: bool = False


class TranscribeResponse(BaseModel):
    text: str
    language: str = ""   # what was actually spoken: en | hi | bn


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
    
class NearbyRequest(BaseModel):
    lat: float
    lng: float


class PrescriptionMedicineItem(BaseModel):
    name: str
    brand_name: Optional[str] = ""
    generic_name: Optional[str] = ""
    strength: Optional[str] = ""
    dosage: Optional[str] = ""
    dose: str = ""  # Backward compatibility: populated with strength or dosage
    frequency: str = ""
    duration: str = ""
    instructions: str = ""
    notes: str = ""  # Backward compatibility: populated with instructions or notes
    confidence: str = "high"  # "high", "medium", or "low"
    is_uncertain: bool = False
    raw_text: Optional[str] = ""
    is_verified: bool = False  # Distinguishes extracted AI data from user-approved records


class PrescriptionExtractionResponse(BaseModel):
    ok: bool
    doctor: str = ""
    date: str = ""
    conditions: list[str] = []
    medicines: list[PrescriptionMedicineItem] = []
    raw_ocr_text: Optional[str] = ""
    ocr_engine_used: str = "qwen/qwen3.8-27b"
    tesseract_available: bool = False
    message: Optional[str] = ""


class MedicalReportTestItem(BaseModel):
    test_name: str
    observed_value: str  # String to distinguish empty/unreadable "" from numeric "0" or "0.0"
    unit: str = ""
    reference_range: str = ""
    page_number: int = 1
    source_text: str = ""
    confidence: str = "high"  # "high", "medium", or "low"
    is_uncertain: bool = False
    is_verified: bool = False  # Explicitly indicates unverified AI output requiring patient/physician check


class MedicalReportExtractionResponse(BaseModel):
    ok: bool
    lab_name: str = ""
    report_date: str = ""
    total_pages: int = 1
    pages_with_digital_text: int = 0
    pages_with_scanned_ocr: int = 0
    tests: list[MedicalReportTestItem] = []
    disclaimer: str = (
        "These results were extracted by AI and have not been medically interpreted or verified. "
        "Smart Companion does not diagnose or recommend treatments. Review all values with a qualified doctor."
    )
    message: Optional[str] = ""


class MedicinePackagingRecognitionResponse(BaseModel):
    ok: bool
    brand_name: str = ""
    generic_name: str = ""
    strength: str = ""
    formulation: str = ""
    manufacturer: str = ""
    batch_number: str = ""
    expiry_date: str = ""
    is_uncertain: bool = False
    uncertainty_reason: str = ""
    raw_visible_text: str = ""
    verification_status: str = "unconfirmed_visual_read_only"
    disclaimer: str = (
        "VISUAL PACKAGING IDENTIFICATION ONLY: This scan transcribes visible text printed on the "
        "medicine packaging for reference. It does NOT verify pharmaceutical authenticity, "
        "chemical safety, or suitability. Never take or adjust medication without consulting "
        "a licensed doctor or pharmacist."
    )
    message: Optional[str] = ""



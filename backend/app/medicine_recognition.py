"""Medicine Packaging Photo Recognition Engine for Smart Companion (Prescription Recognition).

Explores visual recognition of pharmaceutical packaging (boxes, blister strips, bottles).
Strictly scoped as an unconfirmed visual transcriber:
1. Extracts visibly printed Brand Name, Generic Composition (API), Strength, Formulation, and Batch/Expiry.
2. Identifies uncertainty when packaging is cropped, blurry, or partially obstructed.
3. Enforces strict medical guardrails:
   - NEVER recommends taking or purchasing a medicine.
   - NEVER infers dosages, regimens, or indications.
   - Explicitly disclaims verifying medication authenticity or detecting counterfeit drugs.
   - Never automatically adds extracted items into the Health Log.
4. Preserves in-memory caching to avoid redundant model calls for duplicate photos.
"""

from __future__ import annotations

import io
import os
import re
import hashlib
from typing import Dict, Any, Optional

from PIL import Image

from app.llm import client, extract_json
from app.prompts.builder import build_system_prompt
from app.image_preprocessing import (
    preprocess_single_image,
    validate_document_bytes,
    DocumentValidationError,
    DocumentProcessingError,
)
from app.ocr_comparison import check_tesseract_support, extract_text_tesseract

VISION_MODEL = "qwen/qwen3.8-27b"

# In-memory session cache: sha256(bytes) -> dict response
_MEDICINE_PHOTO_CACHE: Dict[str, dict] = {}

PACKAGING_SAFETY_DISCLAIMER = (
    "VISUAL PACKAGING IDENTIFICATION ONLY: This visual scan transcribes visible text printed on the "
    "medicine packaging for reference. It does NOT verify pharmaceutical authenticity, chemical safety, "
    "or suitability. Visual inspection cannot detect counterfeit products. Never take or adjust medication "
    "without consulting a licensed doctor or pharmacist."
)


def _clean_str(val: Any, limit: int = 150) -> str:
    """Cleans string values, normalizes whitespace, and enforces upper bound length."""
    return re.sub(r"\s+", " ", str(val or "")).strip()[:limit]


def _sanitize_packaging_data(raw: Dict[str, Any], raw_ocr_text: str = "") -> Dict[str, Any]:
    """Sanitizes raw model output, enforces safety guardrails, and sets uncertainty status."""
    brand = _clean_str(raw.get("brand_name", ""))
    generic = _clean_str(raw.get("generic_name", ""))
    strength = _clean_str(raw.get("strength", ""))
    formulation = _clean_str(raw.get("formulation", ""))
    manufacturer = _clean_str(raw.get("manufacturer", ""))
    batch = _clean_str(raw.get("batch_number", ""))
    expiry = _clean_str(raw.get("expiry_date", ""))
    raw_text = _clean_str(raw.get("raw_visible_text", "") or raw_ocr_text, limit=1000)

    is_uncertain = bool(raw.get("is_uncertain", False))
    uncertainty_reason = _clean_str(raw.get("uncertainty_reason", ""), limit=250)

    # If neither brand nor generic could be clearly extracted, enforce uncertainty
    if not brand and not generic:
        is_uncertain = True
        if not uncertainty_reason:
            uncertainty_reason = "No clear medicine brand name or active generic composition was legible on the packaging."

    # If strength looks cut off (e.g. ends with trailing dash or digit with no unit)
    if strength and re.search(r"^\d+\s*[-–]?$", strength):
        is_uncertain = True
        if not uncertainty_reason:
            uncertainty_reason = "Dosage strength appears partially cropped or truncated on packaging."

    return {
        "ok": True,
        "brand_name": brand,
        "generic_name": generic,
        "strength": strength,
        "formulation": formulation,
        "manufacturer": manufacturer,
        "batch_number": batch,
        "expiry_date": expiry,
        "is_uncertain": is_uncertain,
        "uncertainty_reason": uncertainty_reason,
        "raw_visible_text": raw_text,
        "verification_status": "unconfirmed_visual_read_only",
        "disclaimer": PACKAGING_SAFETY_DISCLAIMER,
        "message": "",
    }


def recognize_medicine_packaging(image_bytes: bytes) -> Dict[str, Any]:
    """Recognizes and transcribes visible packaging text from an in-memory image buffer.
    
    1. Validates document format and size (in-memory, no disk writes).
    2. Applies orientation correction, deskewing, and CLAHE contrast enhancement
       to counter metallic foil blister reflections and camera glare.
    3. Invokes Groq vision model with strict non-prescription, non-advice system prompts.
    4. Provides local OCR fallback if vision model is unavailable.
    5. Returns sanitized JSON schema with safety disclaimers and uncertainty markers.
    """
    if not image_bytes:
        return {
            "ok": False,
            "message": "Please provide a photograph of the medicine packaging.",
            "disclaimer": PACKAGING_SAFETY_DISCLAIMER,
        }

    # Validate image bytes
    try:
        is_valid, format_type, val_msg = validate_document_bytes(image_bytes)
        if not is_valid:
            return {
                "ok": False,
                "message": val_msg or "Invalid document format or size.",
                "disclaimer": PACKAGING_SAFETY_DISCLAIMER,
            }
        if format_type not in ("jpeg", "png"):
            return {
                "ok": False,
                "message": "Medicine photo recognition requires an image file (JPG, JPEG, or PNG).",
                "disclaimer": PACKAGING_SAFETY_DISCLAIMER,
            }
    except (DocumentValidationError, DocumentProcessingError) as e:
        return {
            "ok": False,
            "message": str(e),
            "disclaimer": PACKAGING_SAFETY_DISCLAIMER,
        }

    # Check in-memory session cache
    content_hash = hashlib.sha256(image_bytes).hexdigest()
    if content_hash in _MEDICINE_PHOTO_CACHE:
        return dict(_MEDICINE_PHOTO_CACHE[content_hash])

    # Preprocess image
    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
        prep_page = preprocess_single_image(pil_img, page_number=1, apply_clahe=True, apply_deskew=True)
        base64_jpeg = prep_page.jpeg_base64
    except Exception as prep_err:
        return {
            "ok": False,
            "message": f"Could not process packaging image: {prep_err}",
            "disclaimer": PACKAGING_SAFETY_DISCLAIMER,
        }

    system_prompt = build_system_prompt("medicine_packaging")
    user_prompt = (
        "Inspect this medicine packaging photograph. Extract only visibly printed information: "
        "brand_name, generic_name (active ingredients), strength, formulation, manufacturer, "
        "batch_number, and expiry_date.\n"
        "If any text is blurry, cut off, or uncertain, set is_uncertain: true and provide the reason.\n"
        "Respond strictly with the specified JSON object."
    )

    extracted_dict: Optional[Dict[str, Any]] = None

    # Primary Route: Groq Vision Model (Qwen 27B)
    try:
        completion = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_jpeg}"}},
                    ],
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            timeout=30.0,
        )
        raw_content = completion.choices[0].message.content or ""
        extracted_dict = extract_json(raw_content)
    except Exception as vision_err:
        print(f"[medicine_recognition] Vision model call failed: {vision_err}")

    # Secondary Route: Tesseract OCR Fallback
    if not extracted_dict:
        try:
            tess_ok, _ = check_tesseract_support()
            if tess_ok:
                print("[medicine_recognition] Attempting Tesseract OCR fallback on packaging photo...")
                ocr_text, _ = extract_text_tesseract(prep_page.enhanced_image)
                if ocr_text and len(ocr_text.strip().split()) >= 2:
                    extracted_dict = {
                        "brand_name": "",
                        "generic_name": "",
                        "strength": "",
                        "formulation": "",
                        "manufacturer": "",
                        "batch_number": "",
                        "expiry_date": "",
                        "is_uncertain": True,
                        "uncertainty_reason": "Read via local OCR fallback; brand and generic composition require manual check.",
                        "raw_visible_text": ocr_text.strip(),
                    }
        except Exception as ocr_err:
            print(f"[medicine_recognition] Tesseract fallback failed: {ocr_err}")

    if not extracted_dict:
        return {
            "ok": False,
            "message": "Could not identify medicine packaging text. Please ensure adequate lighting and hold the packaging steady.",
            "disclaimer": PACKAGING_SAFETY_DISCLAIMER,
        }

    result = _sanitize_packaging_data(extracted_dict)
    _MEDICINE_PHOTO_CACHE[content_hash] = result
    return result

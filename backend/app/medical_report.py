"""Structured Medical Report Intelligence Engine for Smart Companion (Medical Document Intelligence).

Extracts laboratory and pathology test results from:
1. Digitally generated PDFs (fast digital text layer extraction).
2. Scanned PDFs (high-resolution in-memory rasterization + vision extraction).
3. Mixed PDFs (per-page detection of digital vs. scanned content).
4. JPG, JPEG, and PNG images.

Enforces strict medical guardrails:
- Zero clinical diagnoses or treatment recommendations.
- Does NOT calculate or classify abnormality status.
- Strictly distinguishes missing/unreadable values from genuine numerical zeroes (e.g. '0', '0.0', 'Nil').
- Marks all results as unverified AI extractions requiring clinical review.
- In-memory lifecycle caching: prevents redundant vision model calls for duplicate requests.
"""

from __future__ import annotations

import io
import os
import re
import hashlib
from typing import Dict, List, Optional, Tuple, Any

from PIL import Image

try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        fitz = None

from app.llm import client, extract_json
from app.prompts.builder import build_system_prompt
from app.image_preprocessing import (
    preprocess_single_image,
    validate_document_bytes,
    DocumentValidationError,
    DocumentProcessingError,
    MAX_DOCUMENT_BYTES,
)
from app.models import MedicalReportTestItem, MedicalReportExtractionResponse

VISION_MODEL = "qwen/qwen3.8-27b"
MAX_REPORT_PAGES = 10
MIN_DIGITAL_WORDS_PER_PAGE = 15

# In-memory session cache: sha256(bytes) -> MedicalReportExtractionResponse
_REPORT_CACHE: Dict[str, dict] = {}


def _clean(val: Any, limit: int = 100) -> str:
    return re.sub(r"\s+", " ", str(val or "")).strip()[:limit]


def _clean_observed_value(val: Any) -> str:
    """Cleans observed reading while strictly preserving genuine zeroes.
    
    Distinguishes:
    - Genuine zero: "0", "0.0", "0.00", "Nil", "Negative" -> preserved as given
    - Absent/missing/none: None, "", "N/A", "-", "--" -> ""
    """
    if val is None:
        return ""
    s = str(val).strip()
    if s in ("", "-", "--", "N/A", "n/a", "NA"):
        return ""
    # Preserve 0, 0.0, Nil, Non-reactive, etc.
    return re.sub(r"\s+", " ", s)[:50]


def _sanitize_report_data(parsed: dict, total_pages: int, digital_count: int, scanned_count: int) -> dict:
    """Sanitizes raw model output against clinical constraints."""
    raw_tests = parsed.get("tests")
    sanitized_tests: List[dict] = []
    seen = set()

    for item in raw_tests if isinstance(raw_tests, list) else []:
        if not isinstance(item, dict):
            continue

        test_name = _clean(item.get("test_name"), 100)
        if not test_name:
            continue

        observed_value = _clean_observed_value(item.get("observed_value"))
        unit = _clean(item.get("unit"), 40)
        ref_range = _clean(item.get("reference_range"), 60)
        source_text = _clean(item.get("source_text"), 150)
        
        try:
            page_num = max(1, int(item.get("page_number", 1)))
        except (ValueError, TypeError):
            page_num = 1

        confidence = _clean(item.get("confidence") or "high", 20).lower()
        if confidence not in ("high", "medium", "low"):
            confidence = "medium"

        # Explicitly uncertain if missing value, faint, or low confidence
        is_uncertain = bool(item.get("is_uncertain", False) or confidence == "low" or not observed_value)

        record = {
            "test_name": test_name,
            "observed_value": observed_value,
            "unit": unit,
            "reference_range": ref_range,
            "page_number": page_num,
            "source_text": source_text,
            "confidence": confidence,
            "is_uncertain": is_uncertain,
            "is_verified": False,
        }

        # Deduplicate identical test + reading on same page
        dedup_key = (test_name.lower(), observed_value.lower(), page_num)
        if dedup_key not in seen:
            seen.add(dedup_key)
            sanitized_tests.append(record)

    return {
        "ok": True,
        "lab_name": _clean(parsed.get("lab_name"), 100),
        "report_date": _clean(parsed.get("report_date"), 40),
        "total_pages": total_pages,
        "pages_with_digital_text": digital_count,
        "pages_with_scanned_ocr": scanned_count,
        "tests": sanitized_tests[:100],  # Cap at 100 tests per document
        "disclaimer": (
            "These results were extracted by AI and have not been medically interpreted or verified. "
            "Smart Companion does not diagnose or recommend treatments. Review all values with a qualified doctor."
        ),
        "message": "",
    }


def _call_model_for_scanned_page(base64_image: str, page_number: int) -> dict:
    """Dispatches a high-resolution preprocessed page image to Qwen."""
    system_prompt = build_system_prompt("medical_report")
    user_content = [
        {
            "type": "text",
            "text": f"Extract all laboratory test results visible on Page {page_number} of this diagnostic report.",
        },
        {
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"},
        },
    ]

    r = client.chat.completions.create(
        model=VISION_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=0.1,
        max_completion_tokens=2200,
    )
    raw = r.choices[0].message.content or ""
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL)
    parsed = extract_json(raw)
    return parsed if isinstance(parsed, dict) else {}


def _call_model_for_digital_text(page_text: str, page_number: int) -> dict:
    """Processes clean digital text layer without image upload costs."""
    system_prompt = build_system_prompt("medical_report")
    user_content = (
        f"Extract all laboratory test results from the text of Page {page_number} below:\n\n"
        f"\"\"\"\n{page_text[:8000]}\n\"\"\""
    )

    r = client.chat.completions.create(
        model=VISION_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=0.1,
        max_completion_tokens=2000,
    )
    raw = r.choices[0].message.content or ""
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL)
    parsed = extract_json(raw)
    return parsed if isinstance(parsed, dict) else {}


def extract_medical_report(data: bytes) -> dict:
    """Main entry point: extracts structured diagnostic tests from PDF or image medical reports.
    
    Handles digital PDFs, scanned PDFs, mixed PDFs, and single images in memory.
    """
    if len(data) > MAX_DOCUMENT_BYTES:
        return {
            "ok": False,
            "message": f"That file is too big ({len(data) / (1024*1024):.1f} MB). Maximum limit is 10 MB.",
            "tests": [],
        }

    # In-memory document hash check to avoid redundant API spend
    doc_hash = hashlib.sha256(data).hexdigest()
    if doc_hash in _REPORT_CACHE:
        return _REPORT_CACHE[doc_hash]

    is_valid, fmt, err_msg = validate_document_bytes(data)
    if not is_valid:
        return {"ok": False, "message": err_msg, "tests": []}

    combined_parsed: dict = {"lab_name": "", "report_date": "", "tests": []}
    total_pages = 1
    digital_pages_count = 0
    scanned_pages_count = 0

    try:
        if fmt == "pdf":
            if fitz is None:
                return {"ok": False, "message": "PDF engine (PyMuPDF) not available on server.", "tests": []}

            with fitz.open(stream=data, filetype="pdf") as doc:
                total_pages = min(len(doc), MAX_REPORT_PAGES)
                for idx in range(total_pages):
                    page = doc[idx]
                    page_num = idx + 1
                    raw_text = page.get_text("text").strip()
                    word_count = len(raw_text.split())

                    # Check if page has sufficient selectable digital text
                    if word_count >= MIN_DIGITAL_WORDS_PER_PAGE:
                        digital_pages_count += 1
                        page_parsed = _call_model_for_digital_text(raw_text, page_num)
                    else:
                        scanned_pages_count += 1
                        # High-resolution rendering (150-200 DPI) for small print
                        pix = page.get_pixmap(dpi=150)
                        page_bytes = pix.tobytes("png")
                        with Image.open(io.BytesIO(page_bytes)) as pil_img:
                            prep_page = preprocess_single_image(pil_img, page_number=page_num)
                            page_parsed = _call_model_for_scanned_page(prep_page.jpeg_base64, page_num)

                    # Accumulate lab name and date if found
                    if not combined_parsed["lab_name"] and page_parsed.get("lab_name"):
                        combined_parsed["lab_name"] = page_parsed["lab_name"]
                    if not combined_parsed["report_date"] and page_parsed.get("report_date"):
                        combined_parsed["report_date"] = page_parsed["report_date"]

                    # Append tests
                    for t in page_parsed.get("tests", []):
                        if isinstance(t, dict):
                            t["page_number"] = page_num
                            combined_parsed["tests"].append(t)

        else:
            # Single image (JPEG/PNG/WEBP)
            total_pages = 1
            scanned_pages_count = 1
            with Image.open(io.BytesIO(data)) as pil_img:
                prep_page = preprocess_single_image(pil_img, page_number=1)
                combined_parsed = _call_model_for_scanned_page(prep_page.jpeg_base64, 1)

    except Exception as e:
        print(f"[medical_report] extraction failed: {e}")
        return {
            "ok": False,
            "message": "I couldn't read the medical report right now. Please try again or check document clarity.",
            "tests": [],
        }

    out = _sanitize_report_data(
        combined_parsed,
        total_pages=total_pages,
        digital_count=digital_pages_count,
        scanned_count=scanned_pages_count,
    )

    if not out["tests"]:
        return {
            "ok": False,
            "message": "I couldn't find any lab test readings written in that document. Please ensure it is a clearly lit medical test report.",
            "tests": [],
        }

    # Cache successful extraction in memory (max 30 items)
    if len(_REPORT_CACHE) > 30:
        _REPORT_CACHE.clear()
    _REPORT_CACHE[doc_hash] = out

    return out

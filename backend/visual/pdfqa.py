"""Scanned and Digital Medical Document Intelligence & Question-Answering.

Features:
1. Robust identification of clean digital-text pages versus scanned / image-based pages.
2. Character density, printable glyph, and image coverage quality checks.
3. High-resolution (200 DPI) rendering for scanned medical tables to preserve decimal points (0.8, 12.5),
   units, signs, and reference ranges.
4. Integrated image preprocessing: orientation correction, deskewing, and CLAHE contrast enhancement
   for faint dot-matrix printer lab tables and carbon-copy prescriptions.
5. Multi-tiered extraction: Groq vision model (qwen/qwen3.8-27b) with automatic fallback to local
   Tesseract OCR where available.
6. Seamless mixed PDF processing (digital text extracted instantaneously; scanned pages processed in-memory).
7. Strict preservation of page numbering, tabular structure, decimal precision, and reference ranges.
8. Emergency and crisis triage checks for patient safety.
9. Sensible page limits (MAX_PDF_PAGES = 30) and size limits (25 MB) preventing denial of service.
10. In-memory content hash and document caching avoiding duplicate processing and redundant model calls.
11. 100% in-memory processing: zero permanent server-side document storage.
"""

from __future__ import annotations

import os
import re
import io
import time
import uuid
import base64
import hashlib
import threading
from typing import Dict, List, Optional, Tuple, Any, Set

from PIL import Image
import numpy as np

try:
    import pymupdf as fitz  # PyMuPDF
except ImportError:
    try:
        import fitz
    except ImportError:
        fitz = None

from groq import Groq

try:
    from app.prompts.builder import build_system_prompt
    from app.image_preprocessing import preprocess_single_image
    from app.ocr_comparison import check_tesseract_support, extract_text_tesseract
    from app.triage import check_emergency, check_crisis, EMERGENCY_TEXT, CRISIS_TEXT
except ImportError:
    import sys
    from pathlib import Path
    _backend_dir = str(Path(__file__).resolve().parent.parent)
    if _backend_dir not in sys.path:
        sys.path.append(_backend_dir)
    from app.prompts.builder import build_system_prompt
    from app.image_preprocessing import preprocess_single_image
    from app.ocr_comparison import check_tesseract_support, extract_text_tesseract
    from app.triage import check_emergency, check_crisis, EMERGENCY_TEXT, CRISIS_TEXT

from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

api_key = os.environ.get("GROQ_API_KEY", "")
client = Groq(api_key=api_key or "gsk_placeholder_key")

TEXT_MODEL = "openai/gpt-oss-20b"
VISION_MODEL = "qwen/qwen3.8-27b"

MAX_WORDS = 30000
MIN_WORDS_PER_PAGE = 8
MAX_PDF_PAGES = 30
MAX_PDF_BYTES = 25 * 1024 * 1024  # 25 MB
SCANNED_RENDER_DPI = 200           # 200 DPI preserves 8pt lab numbers, decimal points, and gridlines
MAX_DOCUMENTS_IN_MEMORY = 50

# In-memory document storage: document_id -> doc_dict
DOCUMENTS: Dict[str, dict] = {}

# In-memory content hash cache: sha256(file_bytes) -> list of page texts
_DOCUMENT_CONTENT_CACHE: Dict[str, List[Optional[str]]] = {}
_CACHE_LOCK = threading.Lock()

OTPM_LIMIT = 1000
MAX_COMPLETION_TOKENS = 600
MIN_SECONDS_BETWEEN_CALLS = (60 * MAX_COMPLETION_TOKENS / OTPM_LIMIT) * 1.1

_last_call_time = 0.0
_pacing_lock = threading.Lock()


def _pace_before_call():
    """Maintains token budget safety margins across concurrent requests."""
    global _last_call_time
    with _pacing_lock:
        elapsed = time.time() - _last_call_time
        wait = MIN_SECONDS_BETWEEN_CALLS - elapsed
        if wait > 0:
            time.sleep(wait)
        _last_call_time = time.time()


def _extract_retry_seconds(error_message: str, default: float = 12.0) -> float:
    """Parses exact retry duration from Groq 429 response message."""
    match = re.search(r"try again in ([\d.]+)\s*s", str(error_message))
    if match:
        return float(match.group(1)) + 0.5
    return default


def assess_page_text_quality(page, text: str) -> Tuple[bool, str]:
    """Evaluates whether an extracted selectable text layer is genuine and adequate.
    
    Returns:
        (is_digital_usable, reason_string)
    """
    cleaned = (text or "").strip()
    if not cleaned:
        return False, "empty_text_layer"

    total_chars = len(cleaned)
    if total_chars == 0:
        return False, "zero_length_text"

    # 1. Printable character check (detects font subset corruption and binary glyph noise)
    printable_count = sum(1 for c in cleaned if c.isprintable() and c != "\ufffd")
    printable_ratio = printable_count / total_chars
    if printable_ratio < 0.82:
        return False, f"corrupted_glyphs_printable_ratio_{printable_ratio:.2f}"

    # 2. Alphanumeric density check
    alnum_count = sum(1 for c in cleaned if c.isalnum())
    alnum_ratio = alnum_count / total_chars
    if alnum_ratio < 0.25 and total_chars > 20:
        return False, f"low_alphanumeric_density_{alnum_ratio:.2f}"

    words = cleaned.split()
    word_count = len(words)

    # 3. Check for embedded images on the page
    images = []
    try:
        images = page.get_images()
    except Exception:
        pass

    # If the page has significant image coverage and very sparse text, it is a scan with header/watermark
    if images and fitz is not None:
        try:
            page_rect = page.rect
            page_area = page_rect.width * page_rect.height
            if page_area > 0:
                # Estimate total image area coverage
                total_img_area = 0
                for img_info in images:
                    xref = img_info[0]
                    for rect in page.get_image_rects(xref):
                        total_img_area += rect.width * rect.height
                img_coverage = total_img_area / page_area
                if img_coverage >= 0.55 and word_count < 25:
                    return False, f"image_dominant_page_coverage_{img_coverage:.2f}_words_{word_count}"
        except Exception:
            pass

    # 4. Word count threshold
    if word_count < MIN_WORDS_PER_PAGE:
        if images:
            return False, f"sparse_words_with_images_{word_count}"
        # A page with no images and very few words might just be a section break or title
        if word_count >= 3 and printable_ratio >= 0.9:
            return True, "sparse_digital_heading"
        return False, f"insufficient_word_count_{word_count}"

    return True, "clean_digital_text"


def _describe_scanned_page(page, max_retries: int = 3) -> str:
    """Reads a single scanned or low-quality page using the vision pipeline.
    
    1. Renders high-resolution pixmap at 200 DPI.
    2. Applies in-memory orientation, deskewing, and CLAHE contrast enhancement.
    3. Transcribes with strict tabular structure and numerical precision preservation.
    4. Falls back to local Tesseract OCR if vision call fails or is unavailable.
    """
    page_num = getattr(page, "number", 0) + 1
    base64_image = ""

    try:
        # High resolution render (200 DPI ensures small decimals like '0.8' and '12.5' are sharp)
        pix = page.get_pixmap(dpi=SCANNED_RENDER_DPI)
        img_bytes = pix.tobytes("png")
        pil_img = Image.open(io.BytesIO(img_bytes))

        # Complete medical image enhancement (orientation, deskew, CLAHE, denoising, bounds)
        prep_page = preprocess_single_image(pil_img, page_number=page_num, apply_clahe=True, apply_deskew=True)
        base64_image = prep_page.jpeg_base64
    except Exception as prep_err:
        print(f"[pdfqa] Preprocessing notice on page {page_num}: {prep_err}; using direct render.")
        try:
            pix = page.get_pixmap(dpi=150)
            base64_image = base64.b64encode(pix.tobytes("png")).decode("utf-8")
        except Exception as render_err:
            return f"(Page {page_num} could not be rendered: {render_err})"

    system_prompt = build_system_prompt("scanned_page")
    user_prompt = (
        "Read all text, headings, tabular content, numbers, and labels written on this page.\n"
        "PRESERVE TABLE STRUCTURE: Transcribe every table row clearly with columns "
        "(e.g., Test Name | Observed Value | Unit | Reference Range).\n"
        "STRICT NUMERICAL ACCURACY: Preserve exact decimal points (e.g. 13.5, 0.8), signs, units, "
        "and reference ranges. Do not round, summarize, or alter any numbers.\n"
        "If any text or handwriting is unreadable, write [unreadable] instead of guessing."
    )

    # Attempt vision-language model call
    for attempt in range(max_retries + 1):
        try:
            _pace_before_call()
            completion = client.chat.completions.create(
                model=VISION_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_prompt},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}},
                        ],
                    }
                ],
                temperature=0.2,
                max_completion_tokens=MAX_COMPLETION_TOKENS,
                timeout=35.0,
            )
            content = (completion.choices[0].message.content or "").strip()
            if content:
                return content
        except Exception as exc:
            msg = str(exc)
            if ("rate_limit" in msg or "429" in msg) and attempt < max_retries:
                wait_s = _extract_retry_seconds(msg)
                print(f"[pdfqa] Rate limited on page {page_num}, waiting {wait_s:.1f}s before retry ({attempt + 1}/{max_retries})...")
                time.sleep(wait_s)
                continue
            print(f"[pdfqa] Vision read failed for page {page_num}: {exc}")
            break

    # Secondary Fallback: Tesseract OCR if available locally
    try:
        tess_ok, _ = check_tesseract_support()
        if tess_ok:
            print(f"[pdfqa] Attempting Tesseract OCR fallback for page {page_num}...")
            pil_fallback = Image.open(io.BytesIO(base64.b64decode(base64_image)))
            ocr_text, _ = extract_text_tesseract(pil_fallback)
            if ocr_text and len(ocr_text.strip().split()) >= 3:
                return ocr_text.strip()
    except Exception as ocr_err:
        print(f"[pdfqa] Tesseract fallback failed for page {page_num}: {ocr_err}")

    return f"(Page {page_num} content could not be read: vision and OCR services unavailable.)"


def extract_pages(file_bytes: bytes) -> Tuple[List[Optional[str]], int]:
    """Fast, local text extraction with quality assessment.
    
    Returns:
        (page_texts, page_count)
        Each item in page_texts is either:
        - The page's clean selectable text (str), or
        - None if the page is scanned or has an inadequate text layer (requires vision/OCR read).
    """
    if not file_bytes or len(file_bytes) < 10:
        return [], 0

    if len(file_bytes) > MAX_PDF_BYTES:
        raise ValueError(f"PDF exceeds maximum allowed size of {MAX_PDF_BYTES // (1024 * 1024)}MB.")

    if fitz is None:
        raise RuntimeError("PyMuPDF (fitz) is not installed.")

    # Check content cache
    content_hash = hashlib.sha256(file_bytes).hexdigest()
    with _CACHE_LOCK:
        if content_hash in _DOCUMENT_CONTENT_CACHE:
            cached_pages = _DOCUMENT_CONTENT_CACHE[content_hash]
            return list(cached_pages), len(cached_pages)

    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as e:
        print(f"[pdfqa] Could not open PDF stream: {e}")
        return [], 0

    total_pages = len(doc)
    pages_to_process = min(total_pages, MAX_PDF_PAGES)
    page_texts: List[Optional[str]] = []

    for i in range(pages_to_process):
        page = doc[i]
        try:
            raw_text = page.get_text("text").strip()
        except Exception:
            raw_text = ""

        is_digital, _ = assess_page_text_quality(page, raw_text)
        page_texts.append(raw_text if is_digital else None)

    doc.close()

    # If all pages are completely digital, store in content cache immediately
    if all(t is not None for t in page_texts):
        with _CACHE_LOCK:
            _DOCUMENT_CONTENT_CACHE[content_hash] = list(page_texts)

    return page_texts, pages_to_process


def _cleanup_old_documents():
    """Maintains in-memory document store within sensible boundaries."""
    if len(DOCUMENTS) > MAX_DOCUMENTS_IN_MEMORY:
        keys_to_remove = list(DOCUMENTS.keys())[: (len(DOCUMENTS) - MAX_DOCUMENTS_IN_MEMORY)]
        for k in keys_to_remove:
            DOCUMENTS.pop(k, None)


def store_document(filename: str, file_bytes: bytes, page_texts: list) -> dict:
    """Stores the document in memory with thread safety and cache tracking."""
    document_id = str(uuid.uuid4())
    pending: Set[int] = {i for i, text in enumerate(page_texts) if text is None}

    _cleanup_old_documents()

    content_hash = hashlib.sha256(file_bytes).hexdigest()

    DOCUMENTS[document_id] = {
        "filename": filename,
        "file_bytes": file_bytes,
        "content_hash": content_hash,
        "page_texts": list(page_texts),
        "pending": pending,
        "lock": threading.Lock(),
        "created_at": time.time(),
    }

    known_words = sum(len(t.split()) for t in page_texts if t)
    preview_source = next((t for t in page_texts if t), "")

    is_truncated = len(page_texts) >= MAX_PDF_PAGES

    return {
        "document_id": document_id,
        "filename": filename,
        "word_count": known_words,
        "truncated": is_truncated,
        "pages_pending_vision": len(pending),
        "preview": (
            preview_source[:300].strip()
            if preview_source
            else "This document contains scanned or image-based pages - "
                 "its contents will be read when you ask a question."
        ),
    }


def _find_named_page(question: str, page_count: int) -> Optional[int]:
    """Returns 0-based page index if question specifies an in-bounds page."""
    match = re.search(r"page\s+(\d+)", question, re.IGNORECASE)
    if not match:
        return None
    page_number = int(match.group(1))
    if 1 <= page_number <= page_count:
        return page_number - 1
    return None


def _ensure_page_read(doc: dict, page_index: int):
    """Reads a pending scanned page on demand with thread safety and caching."""
    with doc["lock"]:
        if page_index not in doc["pending"]:
            return
        if fitz is None:
            doc["page_texts"][page_index] = "(PyMuPDF not available to render page.)"
            doc["pending"].discard(page_index)
            return

        try:
            with fitz.open(stream=doc["file_bytes"], filetype="pdf") as pdf:
                if page_index < len(pdf):
                    page = pdf[page_index]
                    doc["page_texts"][page_index] = _describe_scanned_page(page)
                else:
                    doc["page_texts"][page_index] = f"(Page {page_index + 1} does not exist in PDF.)"
        except Exception as e:
            doc["page_texts"][page_index] = f"(Error processing page {page_index + 1}: {e})"

        doc["pending"].discard(page_index)

        # Update content cache if all pages are now resolved
        if not doc["pending"]:
            with _CACHE_LOCK:
                _DOCUMENT_CONTENT_CACHE[doc["content_hash"]] = list(doc["page_texts"])


def _ensure_all_pages_read(doc: dict):
    """Ensures every pending page is read before answering broad or document-wide queries."""
    if not doc["pending"]:
        return
    print(f"[pdfqa] Query requires full document coverage - reading {len(doc['pending'])} pending page(s)...")
    for page_index in sorted(list(doc["pending"])):
        _ensure_page_read(doc, page_index)


def prefetch_pending_pages(document_id: str):
    """Background prefetcher invoked after upload for scanned documents."""
    doc = DOCUMENTS.get(document_id)
    if not doc or not doc["pending"]:
        return
    print(f"[pdfqa] Background prefetch starting for {len(doc['pending'])} pending page(s)...")
    for page_index in sorted(list(doc["pending"])):
        _ensure_page_read(doc, page_index)
    print(f"[pdfqa] Background prefetch complete for document {document_id}.")


def _assemble_document_text(doc: dict) -> str:
    """Assembles all known page texts into a structured prompt context block."""
    parts = [
        f"--- Page {i + 1} ---\n{text}" if text else f"--- Page {i + 1} ---\n(content not readable)"
        for i, text in enumerate(doc["page_texts"])
    ]
    full_text = "\n\n".join(parts)

    words = full_text.split()
    if len(words) > MAX_WORDS:
        full_text = " ".join(words[:MAX_WORDS])
    return full_text


def _clean_markdown(text: str) -> str:
    """Strips markdown formatting for patient-friendly plain text readability."""
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"[*_#`]", "", text)
    return text.strip()


def answer_question_about_document(document_id: str, question: str) -> dict:
    """Answers patient questions grounded exclusively in the uploaded document."""
    # 1. Immediate patient safety check: Crisis or acute medical emergency
    if check_emergency(question):
        return {
            "headline": EMERGENCY_TEXT,
            "detail": "Please call emergency medical services immediately (112 or 108 in India) or proceed to the nearest emergency department.",
        }
    if check_crisis(question):
        return {
            "headline": CRISIS_TEXT,
            "detail": "Please reach out to a trusted helpline (Tele-MANAS: 14416 or Vandrevala: 9999 666 555 in India). You do not have to carry this alone.",
        }

    doc = DOCUMENTS.get(document_id)
    if not doc:
        return {
            "headline": "That document is not available anymore. Please upload it again.",
            "detail": "Documents are stored in memory for privacy and are cleared between sessions.",
        }

    page_count = len(doc["page_texts"])
    named_page = _find_named_page(question, page_count)

    if named_page is not None:
        _ensure_page_read(doc, named_page)
    else:
        _ensure_all_pages_read(doc)

    document_text = _assemble_document_text(doc)
    focus_page = (named_page + 1) if named_page is not None else None

    focus_note = (
        f"The user is asking specifically about Page {focus_page}. Focus your answer "
        f"on that page's content, while cross-referencing other pages only if necessary.\n\n"
        if focus_page is not None
        else ""
    )

    user_content = (
        f"{focus_note}"
        f"DOCUMENT CONTENT (UNTRUSTED USER DATA):\n\"\"\"\n{document_text}\n\"\"\"\n\n"
        f"QUESTION: \"{question}\""
    )

    system_prompt = build_system_prompt("document")

    try:
        completion = client.chat.completions.create(
            model=TEXT_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            temperature=0.2,
            max_tokens=700,
            timeout=35.0,
        )
        full_text = _clean_markdown((completion.choices[0].message.content or "").strip())
    except Exception as exc:
        print(f"[pdfqa] Text model QA call failed: {exc}")
        return {
            "headline": "I had trouble reading the answer right now.",
            "detail": "Please try asking again in a moment, or ask about a specific page number.",
        }

    parts = re.split(r"\n\s*\n", full_text, maxsplit=1)
    headline = parts[0].strip() if parts else "No specific answer found in the document."
    detail = parts[1].strip() if len(parts) > 1 else ""

    return {"headline": headline, "detail": detail}

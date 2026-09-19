import os
import re
import time
import uuid
import base64
import threading
import fitz  # PyMuPDF
from groq import Groq

api_key = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=api_key)

TEXT_MODEL = "openai/gpt-oss-20b"
VISION_MODEL = "qwen/qwen3.8-27b"

MAX_WORDS = 30000

MIN_WORDS_PER_PAGE = 5

DOCUMENTS = {}


OTPM_LIMIT = 1000
MAX_COMPLETION_TOKENS = 400
MIN_SECONDS_BETWEEN_CALLS = (60 * MAX_COMPLETION_TOKENS / OTPM_LIMIT) * 1.1  # +10% safety buffer

_last_call_time = 0.0


def _pace_before_call():
    """Sleeps just enough to keep this module's own calls under the shared
    per-minute token budget, assuming the worst case (every call uses its
    full token allowance)."""
    global _last_call_time
    elapsed = time.time() - _last_call_time
    wait = MIN_SECONDS_BETWEEN_CALLS - elapsed
    if wait > 0:
        time.sleep(wait)
    _last_call_time = time.time()


def _extract_retry_seconds(error_message: str, default: float = 15.0) -> float:
    """Groq's 429 messages include the exact wait time, e.g. '...try again
    in 9.84s...'. Parse it so we wait exactly as long as needed, no more,
    no less - falling back to a fixed default if the message shape changes."""
    match = re.search(r"try again in ([\d.]+)\s*s", error_message)
    if match:
        return float(match.group(1)) + 0.5  # small buffer
    return default


def _describe_scanned_page(page, max_retries: int = 4) -> str:
    """Reads a single page via the vision model - renders it to an image
    and asks the model to read out everything on it plainly. Retries on
    rate limits, waiting exactly as long as Groq says to before trying
    again."""
    pix = page.get_pixmap(dpi=100)
    image_bytes = pix.tobytes("png")
    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    for attempt in range(max_retries + 1):
        try:
            _pace_before_call()
            completion = client.chat.completions.create(
                model=VISION_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Read everything written on this page - all text, "
                                         "labels, table contents, and captions - and write "
                                         "it out plainly as flowing sentences. Do not summarize "
                                         "or skip anything; this will be used as the page's "
                                         "text content for later questions.",
                            },
                            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{base64_image}"}},
                        ],
                    }
                ],
                temperature=0.3,
                max_completion_tokens=MAX_COMPLETION_TOKENS,
            )
            return (completion.choices[0].message.content or "").strip()
        except Exception as exc:
            message = str(exc)
            if "rate_limit" in message or "429" in message:
                wait_s = _extract_retry_seconds(message)
                print(f"[pdfqa] rate limited, waiting {wait_s:.1f}s before retry ({attempt + 1}/{max_retries})...")
                time.sleep(wait_s)
                continue
            print(f"[warning] Vision read failed for a page: {exc}")
            return "(This page's content could not be read.)"

    print("[warning] Vision read still rate-limited after retries - giving up on this page.")
    return "(This page's content could not be read right now due to rate limits.)"


def extract_pages(file_bytes: bytes) -> tuple[list, int]:
    """Fast, free, local text extraction only - no vision calls here. Each
    entry in the returned list is either the page's real text, or None if
    the page has no usable text layer (needs a vision read later)."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    page_count = len(doc)
    page_texts = []

    for page in doc:
        page_text = page.get_text().strip()
        page_texts.append(page_text if len(page_text.split()) >= MIN_WORDS_PER_PAGE else None)

    doc.close()
    return page_texts, page_count


def store_document(filename: str, file_bytes: bytes, page_texts: list) -> dict:
    """Saves the document in memory. Pages already flagged as None (no
    text layer) are left for a later, on-demand vision read - nothing
    vision-related happens at upload time."""
    document_id = str(uuid.uuid4())
    pending = {i for i, text in enumerate(page_texts) if text is None}

    DOCUMENTS[document_id] = {
        "filename": filename,
        "file_bytes": file_bytes,
        "page_texts": page_texts,
        "pending": pending,
        "lock": threading.Lock(),
    }

    known_words = sum(len(t.split()) for t in page_texts if t)
    preview_source = next((t for t in page_texts if t), "")

    return {
        "document_id": document_id,
        "filename": filename,
        "word_count": known_words,
        "truncated": False,
        "pages_pending_vision": len(pending),
        "preview": (preview_source[:300].strip() if preview_source
                    else "This page appears to be scanned or image-based - "
                         "its content will be read when you ask a question."),
    }


def _find_named_page(question: str, page_count: int):
    """Returns a 0-based page index if the question names a page number
    that exists in this document, otherwise None."""
    match = re.search(r"page\s+(\d+)", question, re.IGNORECASE)
    if not match:
        return None
    page_number = int(match.group(1))
    if 1 <= page_number <= page_count:
        return page_number - 1
    return None


def _ensure_page_read(doc: dict, page_index: int):
    """Fills in page_texts[page_index] via the vision model if - and only
    if - it's still pending. A no-op for pages already read. Lock-protected
    so a background prefetch and a live question can never both read the
    same page at once."""
    with doc["lock"]:
        if page_index not in doc["pending"]:
            return
        with fitz.open(stream=doc["file_bytes"], filetype="pdf") as pdf:
            page = pdf[page_index]
            doc["page_texts"][page_index] = _describe_scanned_page(page)
        doc["pending"].discard(page_index)


def _ensure_all_pages_read(doc: dict):
    """Used for open-ended questions (no page named), which need full
    document coverage to answer confidently. Reads every still-pending
    page one at a time via _ensure_page_read - each page's result is
    cached, so this only costs anything for pages not already read by a
    background prefetch or an earlier question."""
    if not doc["pending"]:
        return
    print(f"[pdfqa] open-ended question needs full coverage - "
          f"reading {len(doc['pending'])} pending page(s)...")
    for page_index in sorted(doc["pending"]):
        _ensure_page_read(doc, page_index)


def prefetch_pending_pages(document_id: str):
    """Runs in the background right after upload, so scanned pages start
    being read while the user is still typing their question instead of
    only starting once a question arrives. Safe to run alongside a live
    question, since _ensure_page_read is lock-protected."""
    doc = DOCUMENTS.get(document_id)
    if not doc or not doc["pending"]:
        return
    print(f"[pdfqa] prefetching {len(doc['pending'])} pending page(s) in the background...")
    for page_index in sorted(list(doc["pending"])):
        _ensure_page_read(doc, page_index)
    print("[pdfqa] background prefetch done")


def _assemble_document_text(doc: dict) -> str:
    """Joins whatever's currently known into one text block, capped so the
    prompt never becomes unreasonably large."""
    parts = [
        f"Page {i + 1}: {text}" if text else f"Page {i + 1}: (not yet read)"
        for i, text in enumerate(doc["page_texts"])
    ]
    full_text = "\n\n".join(parts)

    words = full_text.split()
    if len(words) > MAX_WORDS:
        full_text = " ".join(words[:MAX_WORDS])
    return full_text


def _clean_markdown(text: str) -> str:
    """Strips markdown symbols (**bold**, *, #) so plain text stays plain."""
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)   # **bold** -> bold
    text = re.sub(r"[*_#`]", "", text)              # remove leftover symbols
    return text.strip()


def _build_prompt(document_text: str, question: str, focus_page: int = None) -> str:
    focus_note = (
        f"The user is asking specifically about page {focus_page}. Focus your "
        f"answer on that page's content, though you may reference other pages "
        f"if useful for context.\n\n" if focus_page is not None else ""
    )
    return f"""You are helping someone understand a document they don't fully
follow - it could be a bank letter, a legal paper, or a homework assignment.
Explain things in plain, simple, everyday language, as you would to a
friend, not with legal or technical jargon.

{focus_note}Answer using ONLY the document below. If the answer isn't in the document,
say so plainly rather than guessing.

Do NOT use markdown formatting - no asterisks, no bullet symbols, no
headers. Write in plain sentences only.

Structure your reply in exactly two parts:
1. FIRST LINE: one short, direct sentence answering the question.
2. Then a blank line, followed by more detail/explanation if useful.

DOCUMENT:
\"\"\"
{document_text}
\"\"\"

QUESTION: "{question}\""""


def answer_question_about_document(document_id: str, question: str) -> dict:
    doc = DOCUMENTS.get(document_id)
    if not doc:
        return {"headline": "That document isn't available anymore - please upload it again.", "detail": ""}

    page_count = len(doc["page_texts"])
    named_page = _find_named_page(question, page_count)

    if named_page is not None:
        _ensure_page_read(doc, named_page)
    else:
        _ensure_all_pages_read(doc)

    document_text = _assemble_document_text(doc)
    focus_page = (named_page + 1) if named_page is not None else None
    prompt = _build_prompt(document_text, question, focus_page)

    completion = client.chat.completions.create(
        model=TEXT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=700,
    )

    full_text = _clean_markdown((completion.choices[0].message.content or "").strip())

    parts = re.split(r"\n\s*\n", full_text, maxsplit=1)
    headline = parts[0].strip()
    detail = parts[1].strip() if len(parts) > 1 else ""

    return {"headline": headline, "detail": detail}
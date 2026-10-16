import io
import re
import base64
from PIL import Image
from app.llm import client, extract_json

VISION_MODEL = "qwen/qwen3.8-27b"
MAX_PAGES = 3
MAX_BYTES = 10_000_000

PROMPT = """This is a photo or scan of a medical prescription (printed or handwritten).
Read ONLY what is actually written on it.

Respond with ONLY raw JSON, no markdown, in exactly this shape:
{"conditions": ["..."], "medicines": [{"name": "", "dose": "", "frequency": "", "duration": "", "notes": ""}], "doctor": "", "date": ""}

Rules:
- "conditions": only diagnoses, complaints or history the doctor WROTE (for example after Dx, Diagnosis, C/o, H/o, "known case of"). If none is written, return []. NEVER guess a condition from a medicine.
- "medicines": every medicine written, in the order shown. "name" exactly as written (brand or generic). "dose" like "500 mg". "frequency" as written, like "1-0-1", "twice daily", "at night". "duration" like "5 days". "notes" like "after food".
- If a field is not written or cannot be read, use "". Do NOT fill it in from your own knowledge. If you cannot read a word, skip it rather than guess.
- Do not include the patient's name, address or phone number anywhere.
- "doctor": the doctor's name if printed, else "". "date": the prescription date if present, else "".
"""


def _pages_as_images(data: bytes):
    if data[:5] == b"%PDF-":
        import fitz  # PyMuPDF - already used by pdfqa.py
        with fitz.open(stream=data, filetype="pdf") as doc:
            for page in list(doc)[:MAX_PAGES]:
                yield Image.open(io.BytesIO(page.get_pixmap(dpi=150).tobytes("png")))
    else:
        yield Image.open(io.BytesIO(data))


def _to_jpeg_b64(img: Image.Image) -> str:
    img = img.convert("RGB")
    img.thumbnail((1800, 1800))          # smaller upload, also drops photo metadata (EXIF/GPS)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=88)
    return base64.b64encode(buf.getvalue()).decode()


def _clean(value, limit: int) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def _sanitize(parsed: dict) -> dict:
    conditions, seen = [], set()
    raw_conditions = parsed.get("conditions")
    for c in raw_conditions if isinstance(raw_conditions, list) else []:
        c = _clean(c, 80)
        if c and c.lower() not in seen:
            seen.add(c.lower())
            conditions.append(c)

    medicines, seen = [], set()
    raw_meds = parsed.get("medicines")
    for m in raw_meds if isinstance(raw_meds, list) else []:
        if not isinstance(m, dict):
            continue
        name = _clean(m.get("name"), 80)
        if not name:
            continue
        item = {
            "name": name,
            "dose": _clean(m.get("dose"), 40),
            "frequency": _clean(m.get("frequency"), 60),
            "duration": _clean(m.get("duration"), 40),
            "notes": _clean(m.get("notes"), 100),
        }
        key = (name.lower(), item["dose"].lower())
        if key not in seen:
            seen.add(key)
            medicines.append(item)

    return {
        "conditions": conditions[:10],
        "medicines": medicines[:25],
        "doctor": _clean(parsed.get("doctor"), 60),
        "date": _clean(parsed.get("date"), 30),
    }


def extract_prescription(data: bytes) -> dict:
    if len(data) > MAX_BYTES:
        return {"ok": False, "message": "That file is too big (maximum 10 MB). Try a smaller photo."}
    try:
        images = [_to_jpeg_b64(i) for i in _pages_as_images(data)]
    except Exception as e:
        print(f"[prescription] could not open file: {e}")
        return {"ok": False, "message": "I couldn't open that file. Please upload a clear photo (JPG or PNG) or a PDF."}
    if not images:
        return {"ok": False, "message": "That file seems to be empty."}

    content = [{"type": "text", "text": PROMPT}] + [
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b}"}} for b in images
    ]
    try:
        r = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[{"role": "user", "content": content}],
            temperature=0.1,
            max_completion_tokens=1800,
        )
        raw = r.choices[0].message.content or ""
    except Exception as e:
        print(f"[prescription] model call failed: {e}")
        return {"ok": False, "message": "I couldn't read the prescription right now. Please try again in a moment."}

    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL)
    parsed = extract_json(raw)
    if not isinstance(parsed, dict):
        return {"ok": False, "message": "I couldn't make sense of that image. Try a clearer, well-lit photo."}

    out = _sanitize(parsed)
    if not out["conditions"] and not out["medicines"]:
        return {"ok": False, "message": "I couldn't find any medicines or conditions written there. Try a clearer photo with the whole page in view."}
    out["ok"] = True
    return out

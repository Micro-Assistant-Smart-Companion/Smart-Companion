import os
import re
import json
import base64
from groq import Groq

api_key = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=api_key)

VISION_MODEL = "qwen/qwen3.8-27b"


def _strip_markdown(text: str) -> str:
    """Safety net in case the model adds markdown despite being told not to."""
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)     # **bold**
    text = re.sub(r"\*(.*?)\*", r"\1", text)          # *italic*
    text = re.sub(r"^\s*[\*\-]\s+", "", text, flags=re.MULTILINE)  # * bullet / - bullet
    text = re.sub(r"^\s*#{1,6}\s*", "", text, flags=re.MULTILINE)  # # headers
    return text.strip()


def _extract_json(raw_text: str):
    """Lenient JSON parsing - strips code fences if present, falls back to
    pulling out the first {...} block if the model added stray text around it."""
    if not raw_text:
        return None
    text = raw_text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None


def _build_instruction(question: str) -> str:
    return f"""Answer the question about this photo for a neurodivergent user who scans
quickly and benefits from short, separated points rather than one dense paragraph.

Respond with ONLY raw JSON, no markdown, no code fences, in this exact shape:
{{"headline": "one short, direct sentence answering the question plainly", "steps": ["first point", "second point"]}}

Rules:
- "headline": the plain, direct answer in one sentence (e.g. "The ball is on the bed, near the pillows.").
- "steps": break any extra detail into short, separate points - one idea per point,
  plain simple sentences, no markdown, no asterisks, no headers. If there's nothing
  more to add beyond the headline, use an empty list for "steps".
- If the image contains a table, schedule, or list, describe it as separate flowing-
  sentence points (e.g. "On weekdays, mornings are for QA.") instead of recreating
  its formatting.

Question: "{question}\""""


def answer_about_image(image_bytes: bytes, question: str) -> dict:
    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    completion = client.chat.completions.create(
        model=VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": _build_instruction(question)},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"},
                    },
                ],
            }
        ],
        temperature=0.4,
        max_completion_tokens=500,
    )

    raw_text = (completion.choices[0].message.content or "").strip()
    parsed = _extract_json(raw_text)

    if not parsed or "headline" not in parsed:
        # Fallback if the model didn't return valid JSON: treat the first
        # line as the headline and split whatever follows into points.
        cleaned = _strip_markdown(raw_text)
        parts = re.split(r"\n\s*\n", cleaned, maxsplit=1)
        headline = parts[0].strip()
        rest = parts[1].strip() if len(parts) > 1 else ""
        steps = [s.strip() for s in re.split(r"\n+", rest) if s.strip()]
        return {"headline": headline, "steps": steps}

    headline = _strip_markdown(str(parsed.get("headline", "")).strip())
    steps = [_strip_markdown(str(s).strip()) for s in parsed.get("steps", []) if str(s).strip()]

    return {"headline": headline, "steps": steps}
import os
import re
import json
import base64
from typing import Optional, List, Dict
from groq import Groq

try:
    from app.prompts.builder import build_system_prompt
except ImportError:
    import sys
    from pathlib import Path
    sys.path.append(str(Path(__file__).resolve().parent.parent))
    from app.prompts.builder import build_system_prompt

from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

api_key = os.environ.get("GROQ_API_KEY", "")
client = Groq(api_key=api_key or "gsk_placeholder_key")

VISION_MODEL = "qwen/qwen3.8-27b"


def _strip_markdown(text: str) -> str:
    """Safety net in case the model adds markdown despite being told not to."""
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)     # **bold**
    text = re.sub(r"\*(.*?)\*", r"\1", text)          # *italic*
    text = re.sub(r"^\s*[\*\-]\s+", "", text, flags=re.MULTILINE)  # * bullet / - bullet
    text = re.sub(r"^\s*#{1,6}\s*", "", text, flags=re.MULTILINE)  # # headers
    return text.strip()


def _extract_json(raw_text: str) -> Optional[dict]:
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


def _build_user_query(question: str, history: Optional[List[Dict[str, str]]] = None) -> str:
    """Build the conversational user message with optional turns."""
    history = history or []
    history_block = ""
    if history:
        turns = "\n".join(f"{t['role'].capitalize()}: {t['content']}" for t in history[-4:])
        history_block = (
            f"Conversation so far:\n{turns}\n\n"
            f"If the question below is a follow-up about something already discussed above, "
            f"use that context in your answer.\n\n"
        )

    return (
        f"{history_block}"
        f"A camera frame is provided.\n"
        f"Question: \"{question}\"\n\n"
        f"Respond with ONLY raw JSON matching: {{\"headline\": \"...\", \"steps\": [\"...\"]}}"
    )


def answer_about_image(image_bytes: bytes, question: str, history: Optional[List[Dict[str, str]]] = None) -> dict:
    """Query the vision model about an image or camera frame using modular vision prompts."""
    system_prompt = build_system_prompt("vision")
    user_query = _build_user_query(question, history)
    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    completion = client.chat.completions.create(
        model=VISION_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_query},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"},
                    },
                ],
            },
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

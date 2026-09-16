
import os
import re
import base64
from groq import Groq

api_key = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=api_key)

VISION_MODEL = "qwen/qwen3.8-27b"  


def _build_instruction(question: str) -> str:
    return f"""Answer the question about this photo for a neurodivergent user who scans
quickly and may only read the first line. Structure your reply in exactly two parts:

1. FIRST LINE: one short, direct sentence answering the question plainly - the
   headline answer only (e.g. "The ball is on the bed, near the pillows.").
2. Then a blank line, followed by more detail and description if useful.

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
        max_completion_tokens=400,
    )

    full_text = (completion.choices[0].message.content or "").strip()
    parts = re.split(r"\n\s*\n", full_text, maxsplit=1)
    headline = parts[0].strip()
    detail = parts[1].strip() if len(parts) > 1 else ""

    return {"headline": headline, "detail": detail}
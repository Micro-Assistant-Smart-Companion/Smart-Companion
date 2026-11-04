# guide.py - powers "live guided search": the user points their camera
# around, and we repeatedly ask the vision model "which way should they
# move to find X".

import os
import base64
import json
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


def get_guidance(image_bytes: bytes, target: str) -> dict:
    """Give directional guidance to find a target object in the camera frame."""
    system_prompt = build_system_prompt("guided_search")
    user_instruction = (
        f'The user is holding a camera, searching for: "{target}".\n'
        f'Inspect this camera frame and respond with raw JSON matching: '
        f'{{"found": true or false, "guidance": "one short instruction, under 12 words"}}'
    )
    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    try:
        completion = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_instruction},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}},
                    ],
                },
            ],
            temperature=0.3,
            max_completion_tokens=150,
        )

        raw_text = (completion.choices[0].message.content or "").strip()
        # Clean any accidental markdown backticks
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()
        return json.loads(raw_text)
    except Exception as exc:
        print(f"[guided_search] failed or rate limited: {exc}")
        return {"found": False, "guidance": "Keep looking around."}

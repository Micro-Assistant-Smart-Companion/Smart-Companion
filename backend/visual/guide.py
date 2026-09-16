# guide.py - powers "live guided search": the user points their camera
# around, and we repeatedly ask the vision model "which way should they
# move to find X". This is a lightweight alternative to true AR overlay -
# no arrows drawn on screen, just short spoken directions repeated as the
# user moves the camera, based on a fresh frame every couple of seconds.

import os
import base64
import json
from groq import Groq

api_key = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=api_key)

VISION_MODEL = "qwen/qwen3.8-27b"


def get_guidance(image_bytes: bytes, target: str) -> dict:
    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    instruction = f"""The user is holding a camera, looking for: "{target}".
Look at this single frame and decide ONE of two things:
- If the object is clearly visible in this frame, say so and briefly describe where in the frame it is. Read everything in the frame, and be specific about the object's location.
- If it is NOT visible in this frame, give ONE short directional instruction for which way to
  turn or move the camera next (e.g. "Turn left", "Look down", "Move forward", "Turn around").

Respond with ONLY raw JSON, no markdown, in this exact shape:
{{"found": true or false, "guidance": "one short spoken instruction, under 12 words"}}"""

    completion = client.chat.completions.create(
        model=VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": instruction},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}},
                ],
            }
        ],
        temperature=0.3,
        max_completion_tokens=150,
    )

    raw_text = (completion.choices[0].message.content or "").strip()
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        return {"found": False, "guidance": "Keep looking around."}
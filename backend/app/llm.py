import os
import json
import re
from groq import Groq

api_key = os.environ.get("GROQ_API_KEY")
if not api_key:
    raise ValueError("GROQ_API_KEY environment variable is not set.")

client = Groq(api_key=api_key)


def extract_json(raw_text: str):
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


def build_prompt(goal: str, reading_level: str, max_steps: int, tone: str,
                  completed_steps: list, history: list = None) -> str:
    history = history or []

    history_block = ""
    if history:
        turns = "\n".join(f"{t['role'].capitalize()}: {t['content']}" for t in history[-8:])
        history_block = f"""Conversation so far:
{turns}

If the new input below is a follow-up question about something already said above
(e.g. "what did you mean by step 2", "why do we do that", "can you explain that more") —
answer it directly using that context in plain terms, and set "is_final" to true.
Otherwise treat the input below as a new goal or question, ignoring the history for
step numbering purposes.

"""

    if completed_steps:
        done_text = "\n".join(f"- {s}" for s in completed_steps)
        progress = f"""Already completed:
{done_text}

Give the NEXT {max_steps} steps. Do not repeat completed steps or summarize the whole task."""
    else:
        progress = f"Give the FIRST {max_steps} steps to start this goal. Do not summarize the whole task."

    return f"""{history_block}You are an assistant for all kinds of users, especially neurodivergent users. The input below may be
either an ACTION goal (something to do and something to solve), a QUESTION (something to know), or a
FOLLOW-UP about something already discussed above.

- If it is an ACTION goal (e.g. "clean my room", "how to book a flight", "write a poem", "solve the math or physics problem"):
  {progress}
- If it is a QUESTION (e.g. "what is photosynthesis", "why is the sky blue", "what is a blackhole"):
  Give a short, clear answer broken into {max_steps} small parts (e.g. one key
  point per step), in the same simple style and then some advanced points. Set "is_final" to true, since a
  question has one complete answer, not an ongoing task.
- If it is a FOLLOW-UP question about the conversation above, answer it directly and set "is_final" to true.

Reading level: {reading_level}. Tone: {tone}.

Respond with ONLY raw JSON - no markdown, no code fences, no extra text
before or after it. Follow this exact shape, with each step as its own
separate object (never put a JSON array or code block inside a "text" value):

{{"steps": [{{"step": 1, "text": "first point"}}, {{"step": 2, "text": "second point"}}], "is_final": false}}

Input: "{goal}"
"""


def decompose_task(goal: str, reading_level: str = "simple", max_steps: int = 3,
                    tone: str = "encouraging", completed_steps: list = None,
                    history: list = None) -> dict:
    completed_steps = completed_steps or []
    prompt = build_prompt(goal, reading_level, max_steps, tone, completed_steps, history)

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024,
        temperature=0.4,
    )

    raw_text = (response.choices[0].message.content or "").strip()
    parsed = extract_json(raw_text)

    if parsed is None or "steps" not in parsed:
        parsed = {
            "steps": [{"step": 1, "text": raw_text or "Sorry, I couldn't generate a response. Please try again."}],
            "is_final": True,
        }

    return parsed
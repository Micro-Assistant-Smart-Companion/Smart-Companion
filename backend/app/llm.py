import os
import json
import re
import time
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
        turns = "\n".join(f"{t['role'].capitalize()}: {t['content']}" for t in history[-4:])
        history_block = f"""Conversation so far:
{turns}

If the new input below is a follow-up question about something already said above
(e.g. "what did you mean by step 2", "why do we do that", "can you explain that more") —
answer it directly using that context in plain terms, and set "is_final" to true.
Otherwise treat the input below as a new goal or question, ignoring the history for
step numbering purposes.

"""

    if completed_steps:
        RECENT_LIMIT = 5
        recent = completed_steps[-RECENT_LIMIT:]
        older_count = len(completed_steps) - len(recent)
        total_so_far = len(completed_steps)

        done_text = "\n".join(f"- {s}" for s in recent)
        older_note = f"(plus {older_count} earlier steps already done)\n" if older_count > 0 else ""

        progress = f"""Already completed ({total_so_far} steps given so far for this goal):
{older_note}{done_text}

Give the NEXT {max_steps} steps, continuing forward from here.
NEVER restart the task from the beginning or repeat earlier stages already listed above.
If this is a finite task (like a recipe, a single errand, or anything with a clear end point)
and it is now naturally complete (e.g. the food is cooked and served, the task is done),
set "is_final" to true instead of inventing more steps.
Many everyday tasks (booking something, using an app, a short errand) are genuinely
finished in just a few steps. If you cannot think of a truly NEW, meaningfully
different next action - and would otherwise just reword or repeat what was
already listed above - that means the task is actually done: set "is_final" to
true and return an empty "steps" list, rather than repeating similar content."""
    else:
        progress = f"""Give the FIRST {max_steps} steps to start this goal. Do not summarize the whole task.

IMPORTANT - avoid decision paralysis, for ANY kind of goal (studying,
applying for a visa, booking something, cooking, cleaning, banking, etc.),
using exactly ONE of these three approaches:

1. If the goal is already specific enough to act on (e.g. "clean my kitchen",
   "book a flight to Delhi", "study for my chemistry exam"), skip
   clarification entirely - just give the normal first steps.

2. If the goal is vague AND you cannot possibly know the real valid options
   (e.g. "study for my exam" - you don't know what subjects this person has;
   "apply for a visa" - you don't know which country; "clean the house" -
   you don't know its layout), respond with exactly ONE step: set
   "clarify" to true, ask ONE simple open question in "text" (e.g. "Which
   subjects do you have for this exam?", "Which country's visa?"), and do
   NOT include a "choices" field - the user will type their own free-text
   answer, since you cannot guess it. NEVER invent a fixed list here (like
   guessing "Math, Science, Hindi") - that would be wrong for most users.

3. If the goal is vague BUT you genuinely already know a short, correct set
   of real options worth offering (e.g. the user already told you their
   subjects are Physics and Chemistry, and you're asking which to start
   with), respond with exactly ONE step: set "clarify" to true, and include
   "choices" (2-4 short options) alongside "text".

In cases 2 and 3, include ONLY that one clarifying step - no other steps -
and set "is_final" to false."""

    choices_shape = '{{"step": 1, "text": "Which one first?", "clarify": true, "choices": ["Option A", "Option B"]}}'
    open_shape = '{{"step": 1, "text": "Which subjects do you have for this exam?", "clarify": true}}'

    return f"""{history_block}You are a warm, friendly companion for all kinds of users, especially neurodivergent users.
Talk like a supportive friend, not a manual - encouraging, patient, never robotic or curt.
The input below may be either an ACTION goal (something to do and something to solve),
a QUESTION (something to know), or a FOLLOW-UP about something already discussed above.

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
separate object (never put a JSON array or code block inside a "text" value).

Include a "time" field ONLY if this is an ACTION goal - a real-world task
that actually takes time to do (e.g. "~5 min", "~2 min"). If this is a
QUESTION or FOLLOW-UP (an explanation, not a task), leave "time" out
entirely - an explanation does not take "5 minutes" to read, so do not
invent a duration for it. Include a "choices" field ONLY for a single
clarifying step as described above - normal steps never have "choices".

Example of a normal step: {{"step": 1, "text": "first point", "time": "~5 min"}}
Example of an open clarifying question (no choices - user types freely): {open_shape}
Example of a choice-based clarifying step (real known options): {choices_shape}

{{"steps": [...one or more step objects as shown above...], "is_final": false}}

Input: "{goal}"
"""


def _call_model(prompt: str):
    start = time.time()
    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024,
        temperature=0.4,
    )
    elapsed = time.time() - start
    raw_text = (response.choices[0].message.content or "").strip()
    return raw_text, elapsed


def decompose_task(goal: str, reading_level: str = "simple", max_steps: int = 3,
                    tone: str = "encouraging", completed_steps: list = None,
                    history: list = None) -> dict:
    completed_steps = completed_steps or []
    prompt = build_prompt(goal, reading_level, max_steps, tone, completed_steps, history)

    raw_text, elapsed = _call_model(prompt)
    parsed = extract_json(raw_text)
    print(f"[timing] LLM response took {elapsed:.2f}s (history_turns={len(history or [])}, completed_steps={len(completed_steps)})")

    if parsed is None or "steps" not in parsed:
        print("[warning] Model did not return steps - retrying without conversation history")
        clean_prompt = build_prompt(goal, reading_level, max_steps, tone, completed_steps, history=None)
        raw_text, elapsed = _call_model(clean_prompt)
        parsed = extract_json(raw_text)
        print(f"[timing] Retry took {elapsed:.2f}s")

    if parsed is None or "steps" not in parsed:
        parsed = {
            "steps": [{"step": 1, "text": "Sorry, I got a bit stuck there - could you try asking that again?"}],
            "is_final": True,
            "was_error": True,  # tells the frontend not to save this into chat history
        }
    steps = parsed.get("steps", [])
    if len(steps) > max_steps:
        print(f"[warning] Model returned {len(steps)} steps, expected {max_steps} - trimming")
        parsed["steps"] = steps[:max_steps]
        parsed["is_final"] = False  
        steps = parsed["steps"]

    if completed_steps and steps and _looks_repetitive(steps, completed_steps):
        print("[warning] New steps look like a repeat of earlier ones - marking task complete instead")
        parsed["steps"] = []
        parsed["is_final"] = True

    return parsed


def _looks_repetitive(new_steps: list, completed_steps: list, threshold: float = 0.55) -> bool:
    """Rough word-overlap check: if the new steps share most of their words
    with the already-completed ones, they're probably a reworded repeat
    rather than genuinely new content."""
    completed_words = set(" ".join(completed_steps).lower().split())
    if not completed_words:
        return False

    overlaps = []
    for step in new_steps:
        step_words = set(str(step.get("text", "")).lower().split())
        if not step_words:
            continue
        overlap = len(step_words & completed_words) / len(step_words)
        overlaps.append(overlap)

    if not overlaps:
        return False
    return (sum(overlaps) / len(overlaps)) >= threshold
import os
import json
import re
import time
from typing import Any, Dict, List, Optional, Tuple
from groq import Groq, RateLimitError
from app.prompts.builder import build_system_prompt

from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

api_key = os.environ.get("GROQ_API_KEY", "")
client = Groq(api_key=api_key or "gsk_placeholder_key")


def extract_json(raw_text: str) -> Optional[dict]:
    """Leniently extract and parse JSON from model output."""
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


def _history_text(history: List[Dict[str, str]], turns: int = 8, per_turn: int = 1200, total: int = 4500) -> str:
    """The recent conversation, newest last. Assistant steps already carry their numbers ("Step 2: ...")."""
    rows = []
    for t in (history or [])[-turns:]:
        who = "User" if t.get("role") == "user" else "Assistant"
        rows.append(f"{who}: {str(t.get('content', ''))[:per_turn]}")
    text = "\n".join(rows)
    return text[-total:] if len(text) > total else text


def build_followup_user_message(goal: str, max_steps: int, history: List[Dict[str, str]]) -> str:
    """A question about what was already said ("explain step 2", "the seed you mentioned, in Bengali")."""
    return (
        f"Here is the conversation so far. The steps you gave earlier are numbered (\"Step 2: ...\").\n"
        f"{_history_text(history)}\n\n"
        f"The user is now asking a FOLLOW-UP about what you already said. Answer it from the conversation above:\n"
        f'- If they name a step ("step 2", "the third step", "second one"), talk about exactly that step.\n'
        f"- If they ask you to repeat a step, say it again in simple words.\n"
        f'- If they ask about a word, ingredient or idea you mentioned (for example "the seed you mentioned"), '
        f"name it and explain it simply, using that step.\n"
        f'- If they ask for a particular language ("in Bengali", "in Hindi"), write the answer in that language '
        f"(Hindi in Devanagari, Bengali in Bengali script). Otherwise keep the language you were told to use.\n"
        f'- Do NOT give new task steps, do NOT start the task over, and do NOT include a "time" field.\n'
        f"- Keep it short: at most {max_steps} small parts, one point per part.\n\n"
        f'Respond with ONLY raw JSON in this exact shape: '
        f'{{"steps": [{{"step": 1, "text": "..."}}], "is_final": true, "followup": true}}\n\n'
        f'Follow-up: "{goal}"'
    )


def build_task_user_message(
    goal: str,
    max_steps: int = 3,
    completed_steps: Optional[List[str]] = None,
    history: Optional[List[Dict[str, str]]] = None,
    followup: bool = False,
) -> str:
    """Build the dynamic user-turn message containing goal, history, and progress state."""
    history = history or []
    completed_steps = completed_steps or []
    if followup and history:
        return build_followup_user_message(goal, max_steps, history)

    history_block = ""
    if history:
        turns = _history_text(history, turns=6)
        history_block = (
            f'Conversation so far (earlier steps are numbered, like "Step 2: ..."):\n{turns}\n\n'
            f"If the new input below is a follow-up question about something already said above "
            f'(e.g. "what did you mean by step 2", "why do we do that", "can you explain that more") — '
            f'answer it directly using that context in plain terms, and set "is_final" to true.\n'
            f"Otherwise treat the input below as a new goal or question, ignoring the history for "
            f"step numbering purposes.\n\n"
        )

    if completed_steps:
        recent_limit = 5
        recent = completed_steps[-recent_limit:]
        older_count = len(completed_steps) - len(recent)
        total_so_far = len(completed_steps)

        done_text = "\n".join(f"- {s}" for s in recent)
        older_note = f"(plus {older_count} earlier steps already done)\n" if older_count > 0 else ""

        progress = (
            f"Already completed ({total_so_far} steps given so far for this goal):\n"
            f"{older_note}{done_text}\n\n"
            f"Give the NEXT {max_steps} steps, continuing forward from here.\n"
            f'Set "is_final" to true ONLY when the last step you give is itself the final action of the task '
            f"(for example the dish is served). If more work remains after your steps, \"is_final\" must be false.\n"
            f"NEVER restart the task from the beginning or repeat earlier stages already listed above.\n"
            f"If this is a finite task and it is now naturally complete, "
            f'set "is_final" to true instead of inventing more steps.\n'
            f"If you cannot think of a truly NEW, meaningfully different next action and would otherwise just "
            f'reword or repeat earlier steps, set "is_final" to true and return an empty "steps" list.'
        )
    else:
        progress = (
            f"Give the FIRST {max_steps} steps to start this goal. Do not summarize the whole task.\n"
            f'These are only the opening steps, so for a multi-stage task "is_final" MUST be false. '
            f'Use true only if the whole task is truly finished within these {max_steps} steps.'
        )

    return (
        f"{history_block}"
        f"Input Goal/Question: \"{goal}\"\n\n"
        f"{progress}\n\n"
        f"Remember: Respond with ONLY valid raw JSON."
    )


def build_prompt(
    goal: str,
    reading_level: str = "simple",
    max_steps: int = 3,
    tone: str = "encouraging",
    completed_steps: Optional[List[str]] = None,
    history: Optional[List[Dict[str, str]]] = None,
    session_note: str = "",
    language: str = "en",
    followup: bool = False,
) -> str:
    """Compose the full monolithic prompt string for backward compatibility."""
    system_prompt = build_system_prompt(
        mode="task",
        context={
            "reading_level": reading_level,
            "tone": tone,
            "language": language,
            "session_note": session_note,
        },
    )
    user_prompt = build_task_user_message(
        goal=goal,
        max_steps=max_steps,
        completed_steps=completed_steps,
        history=history,
        followup=followup,
    )
    return f"{system_prompt}\n\n---\n\n{user_prompt}"


class RateLimited(Exception):
    """Groq API rate limit encountered."""


def _call_model(prompt_or_messages: Any) -> Tuple[str, float]:
    """Invoke the Groq chat completions API with retries on rate limits."""
    if isinstance(prompt_or_messages, list):
        messages = prompt_or_messages
    else:
        messages = [{"role": "user", "content": str(prompt_or_messages)}]

    start = time.time()
    response = None
    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=messages,
                max_tokens=700,
                temperature=0.4,
                extra_body={"reasoning_effort": "low"},
            )
            break
        except RateLimitError as exc:
            m = re.search(r"try again in ([\d.]+)s", str(exc))
            wait = float(m.group(1)) + 0.5 if m else 8
            if attempt == 1 or wait > 15:
                raise RateLimited() from exc
            print(f"[rate limit] waiting {wait:.1f}s then trying once more")
            time.sleep(wait)

    elapsed = time.time() - start
    if response is None or not response.choices:
        return "", elapsed

    raw_text = (response.choices[0].message.content or "").strip()
    return raw_text, elapsed


def decompose_task(
    goal: str,
    reading_level: str = "simple",
    max_steps: int = 3,
    tone: str = "encouraging",
    completed_steps: Optional[List[str]] = None,
    history: Optional[List[Dict[str, str]]] = None,
    session_note: str = "",
    language: str = "en",
    followup: bool = False,
) -> dict:
    """Decompose a goal or answer a question using modular system prompts."""
    completed_steps = completed_steps or []
    history = history or []

    system_prompt = build_system_prompt(
        mode="task",
        context={
            "reading_level": reading_level,
            "tone": tone,
            "language": language,
            "session_note": session_note,
        },
    )
    user_message = build_task_user_message(
        goal=goal,
        max_steps=max_steps,
        completed_steps=completed_steps,
        history=history,
        followup=followup,
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]

    try:
        raw_text, elapsed = _call_model(messages)
    except RateLimited:
        return {
            "steps": [{"step": 1, "text": "I'm getting a lot of requests right now. Please wait about 10 seconds and ask again."}],
            "is_final": True,
            "was_error": True,
        }

    parsed = extract_json(raw_text)
    print(f"[timing] LLM response took {elapsed:.2f}s (history_turns={len(history)}, completed_steps={len(completed_steps)})")

    if parsed is None or "steps" not in parsed:
        print("[warning] Model did not return steps - retrying without conversation history")
        clean_user_message = build_task_user_message(
            goal=goal,
            max_steps=max_steps,
            completed_steps=completed_steps,
            history=history if followup else None,      # a follow-up cannot be answered without the history
            followup=followup,
        )
        clean_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": clean_user_message},
        ]
        try:
            raw_text, elapsed = _call_model(clean_messages)
        except RateLimited:
            raw_text, elapsed = "", 0
        parsed = extract_json(raw_text)
        print(f"[timing] Retry took {elapsed:.2f}s")

    if parsed is None or "steps" not in parsed or not isinstance(parsed.get("steps"), list):
        parsed = {
            "steps": [{"step": 1, "text": "Sorry, I got a bit stuck there - could you try asking that again?"}],
            "is_final": True,
            "was_error": True,
        }

    steps = parsed.get("steps", [])
    parsed["is_followup"] = bool(followup or parsed.get("followup"))
    if parsed["is_followup"]:
        parsed["is_final"] = True            # an answer to a question never shows the "next steps" button

    # Validate and normalize step format
    valid_steps = []
    for idx, s in enumerate(steps):
        if isinstance(s, dict) and "text" in s:
            s["step"] = idx + 1
            valid_steps.append(s)
        elif isinstance(s, str) and s.strip():
            valid_steps.append({"step": idx + 1, "text": s.strip()})
    parsed["steps"] = valid_steps
    steps = valid_steps

    if len(steps) > max_steps:
        print(f"[warning] Model returned {len(steps)} steps, expected {max_steps} - trimming")
        parsed["steps"] = steps[:max_steps]
        parsed["is_final"] = False
        steps = parsed["steps"]

    # First batch with duration estimates shouldn't prematurely mark finite multi-stage task as finished
    if (
        not parsed["is_followup"]
        and not completed_steps
        and len(steps) >= max_steps
        and parsed.get("is_final")
        and any(isinstance(x, dict) and x.get("time") for x in steps)
        and not any(isinstance(x, dict) and x.get("clarify") for x in steps)
    ):
        print("[fix] first batch was marked final although it is a task with time per step - keeping open")
        parsed["is_final"] = False

    if not parsed["is_followup"] and completed_steps and steps and _looks_repetitive(steps, completed_steps):
        print("[warning] New steps look like a repeat of earlier ones - marking task complete instead")
        parsed["steps"] = []
        parsed["is_final"] = True

    return parsed


def _looks_repetitive(new_steps: list, completed_steps: list, threshold: float = 0.55) -> bool:
    """Rough word-overlap check to detect and avoid repetitive step loops."""
    completed_words = set(" ".join(completed_steps).lower().split())
    if not completed_words:
        return False

    overlaps = []
    for step in new_steps:
        if not isinstance(step, dict):
            continue
        step_words = set(str(step.get("text", "")).lower().split())
        if not step_words:
            continue
        overlap = len(step_words & completed_words) / len(step_words)
        overlaps.append(overlap)

    if not overlaps:
        return False
    return (sum(overlaps) / len(overlaps)) >= threshold
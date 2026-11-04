import os
from groq import Groq
from app.prompts.builder import build_system_prompt
from app.prompts.routing import build_routing_prompt

from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

api_key = os.environ.get("GROQ_API_KEY", "")
client = Groq(api_key=api_key or "gsk_placeholder_key")


def classify_intent(goal: str) -> str:
    """Classify the user's message into a domain using the modular routing prompt."""
    system_prompt = build_system_prompt("routing")
    user_prompt = build_routing_prompt(goal)

    try:
        completion = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=60,
            temperature=0.1,
            extra_body={"reasoning_effort": "low"},
        )
        label = (completion.choices[0].message.content or "general").strip().lower()
        return label.split()[0] if label else "general"
    except Exception as exc:
        print(f"[router] classification failed: {exc}, defaulting to general")
        return "general"


def build_agent_system_note(label: str) -> str:
    """A topic-specific instruction applied to the session, based on domain classification."""
    notes = {
        "medical": (
            "This is a wellness-reminder session. Only give general, "
            "well-known lifestyle tips (hydration, diet, common precautions) "
            "- never diagnose, prescribe, or interpret medical reports. "
            "Always remind the user this is not medical advice and to see a doctor."
        ),
        "exam": "This is a study-support session. Focus on exam/homework preparation.",
        "cooking": "This is a cooking-support session. Focus on recipes and kitchen tasks.",
        "cleaning": "This is a home organization and tidying session. Focus on manageable decluttering steps.",
        "finance": "This is a budgeting and planning session. Provide non-advisory organization steps.",
        "travel": "This is a trip-planning session. Focus on checklists, transit schedules, and packing.",
    }
    return notes.get(label, "")

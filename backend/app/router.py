import os
from groq import Groq

api_key = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=api_key)


def classify_intent(goal: str) -> str:
    prompt = f"""Read this message and respond with ONE short lowercase word
that names its topic/domain (e.g. "medical", "exam", "cooking", "cleaning",
"finance", "travel"). If it doesn't fit a clear domain, respond "general".
Respond with ONLY the single word, nothing else.

Message: "{goal}\""""

    completion = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=60,          # this model "thinks" first; 10 tokens were all used up before the answer
        temperature=0.1,
        extra_body={"reasoning_effort": "low"},
    )
    label = (completion.choices[0].message.content or "general").strip().lower()
    # keep it safe/short in case the model adds extra words
    return label.split()[0] if label else "general"


def build_agent_system_note(label: str) -> str:
    """A short extra instruction appended to the main prompt, based on the
    session's topic. Kept intentionally light - the core step-decomposition
    logic in llm.py stays the same for every topic."""
    notes = {
        "medical": (
            "This is a wellness-reminder session. Only give general, "
            "well-known lifestyle tips (hydration, diet, common precautions) "
            "- never diagnose, prescribe, or interpret medical reports. "
            "Always remind the user this is not medical advice and to see a doctor."
        ),
        "exam": "This is a study-support session. Focus on exam/homework preparation.",
        "cooking": "This is a cooking-support session. Focus on recipes and kitchen tasks.",
    }
    return notes.get(label, "")
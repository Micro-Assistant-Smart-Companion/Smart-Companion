import os
import re
from groq import Groq

api_key = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=api_key)


def classify_intent(goal: str) -> str:
    prompt = f"""Read this message and respond with ONE short lowercase word
that names its topic/domain. It may be phrased as a casual first-person
statement, not just a direct question - e.g. "my father have diabetes" is
still "medical"; "i ahve biology exam tomorrow help me prepare" is still
"exam". Judge the underlying topic, not the phrasing or spelling.

Examples: "medical", "exam", "cooking", "cleaning", "finance", "travel".
Only respond "general" if the message genuinely has no identifiable topic
- do not default to "general" just because the phrasing is casual or has
typos.

Respond with ONLY the single word, nothing else.

Message: "{goal}\""""

    completion = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=60,  # this model reasons before answering - too few tokens here leaves content empty
        temperature=0.1,
    )
    raw = (completion.choices[0].message.content or "").strip().lower()
    if not raw:
        print("[router] classify_intent got empty content - defaulting to general")
        return "general"

    label = re.sub(r"[^a-z]", "", raw.split()[0])
    return label if label else "general"


def build_agent_system_note(label: str) -> str:
    """A short extra instruction appended to the main prompt, based on the
    session's topic. Kept intentionally light - the core step-decomposition
    logic in llm.py stays the same for every topic."""
    notes = {
        "medical": (
            "This is a wellness-reminder session. Only give general, "
            "well-known lifestyle tips (hydration, diet, common precautions) "
            "- never diagnose, prescribe, or interpret medical reports. If the "
            "user names a specific medication, condition, or dosage, do NOT "
            "explain its mechanism, uses, or side effects yourself - say only "
            "that this needs a doctor or pharmacist's input, since getting "
            "this wrong could be harmful. Always remind the user this is not "
            "medical advice and to see a doctor."
        ),
        "exam": "This is a study-support session. Focus on exam/homework preparation. Answer questions, explain concepts, and provide study tips. BE VERY FRIENDLY AND ENCOURAGING AND ALSO PROVIDE RIGHT ANSWERS AND EXPLANATIONS",
        "cooking": "This is a cooking-support session. Focus on recipes and kitchen tasks. Answer questions, explain cooking techniques, and provide recipe suggestions. BE VERY FRIENDLY AND ENCOURAGING.",
    }
    return notes.get(label, "")
import os
import json
from groq import Groq

api_key = os.environ.get("GROQ_API_KEY")
if not api_key:
    raise ValueError("GROQ_API_KEY environment variable is not set.")

client = Groq(api_key=api_key)

def build_prompt(goal: str, reading_level: str, max_steps: int, tone: str) -> str:
    return f"""You are a helpful task-decomposition assistant for a user(any user, can be neurodivergent user also). 
Reading level : {reading_level} (use short, simple sentences if "simple" according to user's reading level).
Tone : {tone}.
Break the goal below into {max_steps} very small , immediate, non - intimidating steps that a user can take to achieve the goal.
Respnd with only valid JSON , in this format: [{{"step": 1, "text": "..."}}, {{"step": 2, "text": "..."}}]
Goal: "{goal}" """

def decompose_task(goal: str, reading_level: str = "simple", max_steps: int = 3, tone: str = "encouraging") -> list:
    prompt = build_prompt(goal, reading_level, max_steps, tone)
    response = client.chat.completions.create(
        model = "openai/gpt-oss-20b",
        messages = [{"role" : "user", "content" : prompt}],
        max_tokens = 300,
        temperature = 0.4,
    )
    
    raw_text = response.choices[0].message.content
    try:
        steps = json.loads(raw_text)
    except json.JSONDecodeError:
        steps = [{"step": 1, "text": raw_text.strip()}]
 
    return steps
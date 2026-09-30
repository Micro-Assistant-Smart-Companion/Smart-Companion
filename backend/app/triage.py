EMERGENCY_PATTERNS = [
    "chest pain", "can't breathe", "cannot breathe", "difficulty breathing",
    "severe bleeding", "heavy bleeding", "unconscious", "unresponsive",
    "suicidal", "want to die", "kill myself", "self harm", "overdose",
    "seizure", "having a stroke", "heart attack", "severe allergic reaction",
    "anaphylaxis", "numbness on one side", "can't wake up", "not breathing",
]


def check_emergency(text: str) -> bool:
    lowered = text.lower()
    return any(p in lowered for p in EMERGENCY_PATTERNS)
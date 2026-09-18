import spacy

nlp = spacy.load("en_core_web_sm")
SENSITIVE_LABELS = {"PERSON", "ORG", "GPE", "LOC", "DATE", "TIME"}

SAFE_WORDS = {
    "AC", "TV", "PC", "ID", "OK", "ATM", "AI", "US", "UK", "EU",
    "CEO", "CAT", "XAT", "NMAT", "SNAP", "MBA", "IIM", "GPS",
}


def redact_text(text: str) -> str:
    doc = nlp(text)
    redacted = text
    for ent in doc.ents:
        if ent.label_ not in SENSITIVE_LABELS:
            continue

        entity_text = ent.text.strip()
        if entity_text.upper() in SAFE_WORDS:
            continue
        if len(entity_text) <= 3 and entity_text.isupper() and " " not in entity_text:
            continue

        redacted = redacted.replace(entity_text, "[REDACTED]")

    return redacted
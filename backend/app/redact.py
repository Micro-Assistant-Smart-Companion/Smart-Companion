import spacy

nlp = spacy.load("en_core_web_sm")
SENSITIVE_LABELS = {"PERSON", "ORG", "GPE", "LOC", "DATE", "TIME"}

def redact_text(text: str) -> str:
    doc = nlp(text)
    redacted = text
    for ent in doc.ents:
        if ent.label_ in SENSITIVE_LABELS:
            redacted = redacted.replace(ent.text, "[REDACTED]")
            
    return redacted
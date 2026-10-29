import os
import re
from groq import Groq

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

MODEL = "whisper-large-v3"            
SUPPORTED = ("en", "hi", "bn")
# Whisper often labels Hindi as Urdu and Bengali as Assamese: re-read those in the right language.
ALIASES = {"ur": "hi", "as": "bn"}
NAMES = {"english": "en", "hindi": "hi", "bengali": "bn", "bangla": "bn", "urdu": "ur", "assamese": "as"}


def _get(obj, key, default=None):
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _lang_code(value) -> str:
    v = str(value or "").strip().lower()
    return NAMES.get(v, v)


EN_PROMPT = ("Indian English speaker. Health words: blood pressure, BP, sugar, glucose, pulse, oxygen, temperature, "
             "migraine, diabetes, headache, tablet, dose, once a day, twice a day, after food, emergency card.")


def _prompt(language: str | None, vocab: str) -> str:
    """A short hint that helps Whisper with an Indian accent and with the person's own medicine names."""
    vocab = re.sub(r"[^\w ,.\-/()\u0900-\u097F\u0980-\u09FF]", " ", vocab or "", flags=re.UNICODE)[:250].strip()
    parts = []
    if language in (None, "en"):
        parts.append(EN_PROMPT)
    if vocab:
        parts.append(f"Medicines: {vocab}.")
    return " ".join(parts)


def _call(audio: bytes, filename: str, content_type: str, language: str | None, vocab: str = ""):
    kwargs = dict(model=MODEL, file=(filename, audio, content_type), temperature=0.0,
                  response_format="verbose_json")
    if language:
        kwargs["language"] = language
    p = _prompt(language, vocab)
    if p:
        kwargs["prompt"] = p
    return client.audio.transcriptions.create(**kwargs)


def _dedupe(text: str) -> str:
    parts = re.split(r"(?<=[.!?।])\s+", text)
    out, last = [], None
    for p in parts:
        key = re.sub(r"[\W_]+", "", p.lower())
        if key and key == last:
            continue
        last = key
        out.append(p)
    return " ".join(out).strip(" -")


def clean_transcript(resp) -> str:
    segments = _get(resp, "segments") or []
    if not segments:
        return (_get(resp, "text") or "").strip()
    kept = []
    for s in segments:
        no_speech = _get(s, "no_speech_prob", 0) or 0
        logprob = _get(s, "avg_logprob", 0) or 0
        compression = _get(s, "compression_ratio", 0) or 0
        if no_speech > 0.6 and logprob < -1.0:     # Whisper itself says: this is silence
            continue
        if compression > 2.4:                      # the same words looping
            continue
        text = (_get(s, "text") or "").strip()
        if text:
            kept.append(text)
    return _dedupe(" ".join(kept))


def transcribe_detect(audio: bytes, filename: str = "audio.webm", content_type: str = "audio/webm",
                      hint: str = "en", auto: bool = False, vocab: str = "") -> dict:
    """Returns {"text": ..., "language": "en"|"hi"|"bn"}.
    Default (auto=False): the language picked in the app is used as it is. It never changes by itself, because
    guessing the language from one short sentence is unreliable (accented English was taken for Hindi or Bengali).
    auto=True: let Whisper listen and detect, like before."""
    hint = hint if hint in SUPPORTED else "en"
    if not auto:
        return {"text": clean_transcript(_call(audio, filename, content_type, hint, vocab)), "language": hint}
    first = _call(audio, filename, content_type, None, vocab)          # let Whisper listen and detect
    raw = _lang_code(_get(first, "language"))
    target = raw if raw in SUPPORTED else ALIASES.get(raw, hint)
    if target == raw:
        return {"text": clean_transcript(first), "language": target}
    second = _call(audio, filename, content_type, target, vocab)       # re-read in the right language
    return {"text": clean_transcript(second), "language": target}
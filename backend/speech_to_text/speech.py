# speech_to_text/speech.py  (replace the old file)
# Whisper on Groq. Three protections against "random text":
#   1. it detects which language was really spoken (so Hindi is never forced into Bengali letters),
#   2. it throws away segments Whisper itself marks as "probably no speech" or as a repetition loop,
#   3. it removes sentences that are repeated back to back.
import os
import re
from groq import Groq

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

MODEL = "whisper-large-v3"            # better than "turbo" for Hindi / Bengali
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


def _call(audio: bytes, filename: str, content_type: str, language: str | None):
    kwargs = dict(model=MODEL, file=(filename, audio, content_type), temperature=0.0,
                  response_format="verbose_json")
    if language:
        kwargs["language"] = language
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
                      hint: str = "en") -> dict:
    """Returns {"text": ..., "language": "en"|"hi"|"bn"}. `hint` = the language picked in the app,
    used only when Whisper cannot tell what was spoken."""
    hint = hint if hint in SUPPORTED else "en"
    first = _call(audio, filename, content_type, None)          # let Whisper listen and detect
    raw = _lang_code(_get(first, "language"))
    target = raw if raw in SUPPORTED else ALIASES.get(raw, hint)
    if target == raw:
        return {"text": clean_transcript(first), "language": target}
    second = _call(audio, filename, content_type, target)       # re-read in the right language
    return {"text": clean_transcript(second), "language": target}


def transcribe_audio_bytes(audio_bytes: bytes, filename: str = "audio.webm",
                           content_type: str = "audio/webm", language: str = "en") -> str:
    return transcribe_detect(audio_bytes, filename, content_type, language)["text"]
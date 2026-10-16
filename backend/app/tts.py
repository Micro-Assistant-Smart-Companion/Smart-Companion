import io
from gtts import gTTS

SUPPORTED = {"en", "hi", "bn"}


def speak_mp3(text: str, lang: str) -> bytes:
    buf = io.BytesIO()
    gTTS(text=text[:600], lang=lang if lang in SUPPORTED else "en").write_to_fp(buf)
    return buf.getvalue()

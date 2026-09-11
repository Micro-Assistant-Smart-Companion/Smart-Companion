import os
from groq import Groq

api_key = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=api_key)


def transcribe_audio_bytes(audio_bytes: bytes, filename: str = "audio.webm", content_type: str = "audio/webm") -> str:
    file_tuple = (filename, audio_bytes, content_type)
    transcript = client.audio.transcriptions.create(
        model="whisper-large-v3-turbo",
        file=file_tuple,
        language="en",
        temperature=0.0,
    )
    return transcript.text.strip()
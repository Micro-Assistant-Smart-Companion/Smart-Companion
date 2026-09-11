import pyaudio
import numpy as np
import queue


class MicCapture:
    def __init__(self):
        self.p = pyaudio.PyAudio()
        self.audio_queue = queue.Queue()
        self.stream = None
        self.mic_info = self.p.get_default_input_device_info()

    def start(self):
        rate = int(self.mic_info["defaultSampleRate"])

        def callback(in_data, frame_count, time_info, status):
            if in_data:
                self.audio_queue.put(np.frombuffer(in_data, dtype=np.float32))
            return (in_data, pyaudio.paContinue)

        self.stream = self.p.open(
            format=pyaudio.paFloat32, channels=1, rate=rate, input=True,
            input_device_index=self.mic_info["index"], stream_callback=callback,
        )

    def stop(self):
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
        self.p.terminate()

    def get_audio_chunk(self):
        try:
            return self.audio_queue.get(timeout=0.1)
        except queue.Empty:
            return None
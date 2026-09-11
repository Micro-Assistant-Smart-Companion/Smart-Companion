import torch
import numpy as np


class StreamingVAD:
    def __init__(self, target_rate=16000, chunk_size=512):
        self.target_rate = target_rate
        self.chunk_size = chunk_size
        self.model, utils = torch.hub.load(repo_or_dir='snakers4/silero-vad', model='silero_vad', force_reload=False)
        VADIterator = utils[3]
        self.vad_iterator = VADIterator(
            self.model, threshold=0.5, sampling_rate=target_rate,
            min_silence_duration_ms=180, speech_pad_ms=30,
        )
        self.buffer = torch.tensor([])

    def _fast_resample(self, tensor_audio, orig_rate):
        if orig_rate == self.target_rate:
            return tensor_audio
        new_len = int(tensor_audio.shape[0] * (self.target_rate / orig_rate))
        if new_len == 0:
            return torch.tensor([])
        resampled = torch.nn.functional.interpolate(
            tensor_audio.view(1, 1, -1), size=new_len, mode='linear', align_corners=False
        )
        return resampled.view(-1)

    def process(self, audio_chunk, source_rate, source_channels):
        if source_channels > 1:
            audio_chunk = np.mean(audio_chunk.reshape(-1, source_channels), axis=1)

        tensor_audio = self._fast_resample(torch.from_numpy(audio_chunk), source_rate)
        if len(tensor_audio) == 0:
            return [], torch.tensor([])

        self.buffer = torch.cat((self.buffer, tensor_audio))
        speech_events, valid_chunks = [], []

        while len(self.buffer) >= self.chunk_size:
            chunk = self.buffer[:self.chunk_size]
            self.buffer = self.buffer[self.chunk_size:]
            speech_dict = self.vad_iterator(chunk, return_seconds=True)
            if speech_dict:
                speech_events.append(speech_dict)
            valid_chunks.append(chunk)

        processed_audio = torch.cat(valid_chunks) if valid_chunks else torch.tensor([])
        return speech_events, processed_audio
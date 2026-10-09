"""
Ghost local voice server: free voice cloning with Resemble AI's Chatterbox (MIT licence,
https://github.com/resemble-ai/chatterbox). It runs on your own machine (Apple Silicon
MPS, NVIDIA CUDA or CPU) and the Ghost Node server calls it when VOICE_PROVIDER=free.

  GET    /health          → model / device status
  POST   /voices          multipart: audio (16-bit PCM WAV, ≥6 s), name → {"voice_id": ...}
  DELETE /voices/{id}
  POST   /tts             JSON {"text": ..., "voice_id": ...} → audio/wav

Reference recordings stay on disk in voices/ (or VOICE_DIR) and never leave the machine.
"""
import io
import json
import os
import re
import threading
import time
import uuid
import wave
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

VOICES_DIR = Path(os.getenv("VOICE_DIR", Path(__file__).parent / "voices"))
MODEL_NAME = os.getenv("VOICE_MODEL", "turbo")  # "turbo" (faster) or "standard"
FAKE = os.getenv("GHOST_VOICE_FAKE") == "1"       # tests: skip torch, emit a tone
MIN_REFERENCE_SECONDS = 6.0                       # Chatterbox Turbo needs a prompt over 5 s
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
VOICE_ID = re.compile(r"^[0-9a-f]{32}$")


def pick_device():
    if os.getenv("VOICE_DEVICE"):
        return os.getenv("VOICE_DEVICE")
    import torch
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


class ChatterboxEngine:
    """Wraps a Chatterbox model and caches each voice's conditioning."""

    def __init__(self):
        if MODEL_NAME == "standard":
            from chatterbox.tts import ChatterboxTTS as Model
        else:
            from chatterbox.tts_turbo import ChatterboxTurboTTS as Model
        self.device = pick_device()
        print(f"[voice] Loading Chatterbox {MODEL_NAME} on {self.device} (first run downloads the weights)…")
        self.model = Model.from_pretrained(device=self.device)
        self.sample_rate = self.model.sr
        self._conds = {}
        self._lock = threading.Lock()  # model.conds is shared state

    def synthesize(self, text, voice_id, reference_wav):
        with self._lock:
            if voice_id not in self._conds:
                self.model.prepare_conditionals(str(reference_wav))
                self._conds[voice_id] = self.model.conds
            self.model.conds = self._conds[voice_id]
            wav = self.model.generate(text)
        return wav.squeeze(0).detach().cpu().numpy(), self.sample_rate

    def forget(self, voice_id):
        self._conds.pop(voice_id, None)


class FakeEngine:
    """Stand-in used by the tests: a short tone instead of real speech."""

    device = "fake"
    sample_rate = 24000

    def __init__(self):
        self.prepared = []

    def synthesize(self, text, voice_id, reference_wav):
        if voice_id not in self.prepared:
            self.prepared.append(voice_id)
        t = np.arange(int(self.sample_rate * 0.25)) / self.sample_rate
        return (0.2 * np.sin(2 * np.pi * 220 * t)).astype(np.float32), self.sample_rate

    def forget(self, voice_id):
        if voice_id in self.prepared:
            self.prepared.remove(voice_id)


_engine = None
_engine_lock = threading.Lock()


def get_engine():
    global _engine
    with _engine_lock:
        if _engine is None:
            _engine = FakeEngine() if FAKE else ChatterboxEngine()
    return _engine


def wav_duration(data: bytes) -> float:
    with wave.open(io.BytesIO(data)) as w:
        if w.getsampwidth() != 2:
            raise ValueError("expected 16-bit samples")
        return w.getnframes() / w.getframerate()


def to_wav_bytes(samples: np.ndarray, sample_rate: int) -> bytes:
    pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


def voice_path(voice_id: str) -> Path:
    if not VOICE_ID.match(voice_id):
        raise HTTPException(404, "Unknown voice")
    path = VOICES_DIR / f"{voice_id}.wav"
    if not path.exists():
        raise HTTPException(404, "Unknown voice")
    return path


app = FastAPI(title="Ghost voice server")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": "fake" if FAKE else MODEL_NAME,
        "device": _engine.device if _engine else None,
        "loaded": _engine is not None,
        "voices": len(list(VOICES_DIR.glob("*.wav"))) if VOICES_DIR.exists() else 0,
    }


@app.post("/voices")
async def create_voice(audio: UploadFile = File(...), name: str = Form("Ghost Rep")):
    data = await audio.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Recording is too large")
    try:
        duration = wav_duration(data)
    except (wave.Error, EOFError, ValueError):
        raise HTTPException(400, "Upload a 16-bit PCM WAV recording")
    if duration < MIN_REFERENCE_SECONDS:
        raise HTTPException(400, f"Record at least {MIN_REFERENCE_SECONDS:.0f} seconds of speech (got {duration:.1f}s)")

    voice_id = uuid.uuid4().hex
    VOICES_DIR.mkdir(parents=True, exist_ok=True)
    (VOICES_DIR / f"{voice_id}.wav").write_bytes(data)
    (VOICES_DIR / f"{voice_id}.json").write_text(
        json.dumps({"name": name[:100], "created": time.time(), "duration_s": round(duration, 1)})
    )
    return {"voice_id": voice_id, "name": name, "duration_s": round(duration, 1)}


@app.delete("/voices/{voice_id}")
def delete_voice(voice_id: str):
    path = voice_path(voice_id)
    path.unlink()
    path.with_suffix(".json").unlink(missing_ok=True)
    if _engine is not None:
        _engine.forget(voice_id)
    return {"deleted": voice_id}


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=800)
    voice_id: str


@app.post("/tts")
def tts(req: TTSRequest):  # plain def: FastAPI runs it in a worker thread
    reference = voice_path(req.voice_id)
    samples, sample_rate = get_engine().synthesize(req.text, req.voice_id, reference)
    return Response(to_wav_bytes(samples, sample_rate), media_type="audio/wav")


if __name__ == "__main__":
    import uvicorn

    get_engine()  # load the model before accepting requests
    uvicorn.run(app, host=os.getenv("VOICE_HOST", "127.0.0.1"), port=int(os.getenv("VOICE_PORT", "8005")))

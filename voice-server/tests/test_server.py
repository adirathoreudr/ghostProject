import importlib
import io
import sys
import wave
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def make_wav(seconds, rate=24000, width=2):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(width)
        w.setframerate(rate)
        w.writeframes(b"\x01\x00" * int(seconds * rate) if width == 2 else b"\x01" * int(seconds * rate))
    return buf.getvalue()


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setenv("GHOST_VOICE_FAKE", "1")
    monkeypatch.setenv("VOICE_DIR", str(tmp_path))
    import server
    server = importlib.reload(server)
    return server


@pytest.fixture
def client(app):
    return TestClient(app.app)


def create(client, seconds=8.0, name="Ana"):
    return client.post("/voices", files={"audio": ("v.wav", make_wav(seconds), "audio/wav")}, data={"name": name})


def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["model"] == "fake"
    assert body["voices"] == 0


def test_create_voice_stores_the_reference(client, tmp_path):
    res = create(client)
    assert res.status_code == 200
    voice_id = res.json()["voice_id"]
    assert len(voice_id) == 32
    assert (tmp_path / f"{voice_id}.wav").exists()
    assert client.get("/health").json()["voices"] == 1


def test_create_voice_rejects_short_or_invalid_audio(client):
    short = create(client, seconds=2)
    assert short.status_code == 400
    assert "at least 6 seconds" in short.json()["detail"]

    not_wav = client.post("/voices", files={"audio": ("v.webm", b"\x1aE\xdf\xa3 webm", "audio/webm")})
    assert not_wav.status_code == 400

    eight_bit = client.post("/voices", files={"audio": ("v.wav", make_wav(8, width=1), "audio/wav")})
    assert eight_bit.status_code == 400


def test_tts_returns_wav_and_caches_conditioning(client, app):
    voice_id = create(client).json()["voice_id"]
    for _ in range(2):
        res = client.post("/tts", json={"text": "What would it cost you not to fix this?", "voice_id": voice_id})
        assert res.status_code == 200
        assert res.headers["content-type"] == "audio/wav"
        with wave.open(io.BytesIO(res.content)) as w:
            assert w.getframerate() == 24000
            assert w.getnframes() > 0
    assert app.get_engine().prepared == [voice_id]


def test_tts_validation(client):
    assert client.post("/tts", json={"text": "hi", "voice_id": "0" * 32}).status_code == 404
    assert client.post("/tts", json={"text": "hi", "voice_id": "../../etc/passwd"}).status_code == 404
    voice_id = create(client).json()["voice_id"]
    assert client.post("/tts", json={"text": "", "voice_id": voice_id}).status_code == 422
    assert client.post("/tts", json={"text": "x" * 801, "voice_id": voice_id}).status_code == 422


def test_delete_voice(client, tmp_path):
    voice_id = create(client).json()["voice_id"]
    assert client.delete(f"/voices/{voice_id}").status_code == 200
    assert not (tmp_path / f"{voice_id}.wav").exists()
    assert client.post("/tts", json={"text": "hi", "voice_id": voice_id}).status_code == 404
    assert client.delete(f"/voices/{voice_id}").status_code == 404


def test_to_wav_bytes_clips_samples(app):
    data = app.to_wav_bytes(np.array([2.0, -2.0, 0.5], dtype=np.float32), 16000)
    with wave.open(io.BytesIO(data)) as w:
        frames = np.frombuffer(w.readframes(3), dtype="<i2")
    assert list(frames) == [32767, -32767, 16383]

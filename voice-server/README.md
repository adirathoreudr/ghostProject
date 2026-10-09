# Ghost voice server (free mode)

A small local HTTP server that clones your voice and speaks Ghost's replies in it, for free.
It wraps [Chatterbox](https://github.com/resemble-ai/chatterbox) by Resemble AI (MIT licence).
The Ghost Node server calls it when `VOICE_PROVIDER=free`.

## Setup

Use Python 3.10–3.13 (3.11 recommended). From the repo root:

```bash
npm run voice:setup      # creates voice-server/.venv and installs requirements
npm run voice:start      # serves http://127.0.0.1:8005
```

Or run `npm run dev:free` to start the voice server, the Ghost server and the client together.

The first start downloads the model weights from Hugging Face (about 1–2 GB, cached afterwards).

## Settings (environment variables)

| Variable | Default | |
|---|---|---|
| `VOICE_MODEL` | `turbo` | `turbo` (350M, faster) or `standard` (500M) |
| `VOICE_DEVICE` | auto | `mps` (Apple Silicon), `cuda` or `cpu`. Auto-detect tries them in the order cuda → mps → cpu |
| `VOICE_DIR` | `voice-server/voices` | Where reference recordings are kept |
| `VOICE_HOST` / `VOICE_PORT` | `127.0.0.1` / `8005` | Bind address. Keep it on localhost |

## API

| Method | Path | |
|---|---|---|
| `GET` | `/health` | Model, device, number of voices |
| `POST` | `/voices` | multipart `audio` (16-bit PCM WAV, at least 6 s) and `name` → `{ "voice_id" }` |
| `DELETE` | `/voices/{voice_id}` | Remove a voice |
| `POST` | `/tts` | JSON `{ "text", "voice_id" }` → `audio/wav` |

The Ghost client converts recordings to WAV in the browser before uploading them, so no ffmpeg is needed.

## Tests

```bash
npm run test:voice
```

The tests run with `GHOST_VOICE_FAKE=1`, which swaps the model for a tone generator, so they need neither PyTorch nor the model weights.

## Notes

- Your reference recordings never leave your machine, and `voices/` is git-ignored.
- Chatterbox adds Resemble AI's inaudible Perth watermark to generated audio.
- Only clone voices you have permission to use.

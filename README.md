<div align="center">

```
 ██████╗ ██╗  ██╗ ██████╗ ███████╗████████╗
██╔════╝ ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
██║  ███╗███████║██║   ██║███████╗   ██║   
██║   ██║██╔══██║██║   ██║╚════██║   ██║   
╚██████╔╝██║  ██║╚██████╔╝███████║   ██║   
 ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝  
```

**Real-Time Voice Sales Co-Pilot**

*Your AI doesn't coach you. It becomes you.*

[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-Speech%20Engine-orange?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyeiIvPjwvc3ZnPg==)](https://elevenlabs.io)
[![NVIDIA NIM](https://img.shields.io/badge/NVIDIA%20NIM-Llama%203.3%2070B-76b900?style=flat-square)](https://build.nvidia.com)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![Built for](https://img.shields.io/badge/Built%20for-ElevenLabs%20Hackathon%20%239-e94560?style=flat-square)](https://hacks.elevenlabs.io)

</div>

---

## The Problem

Sales reps lose deals in the objection moment — not because they don't know the answer, but because they **freeze, fumble, or respond with the wrong frame** under pressure.

Existing tools record calls and coach *after the fact*. Zero help when it matters.

## What Ghost Does

When a prospect throws an objection during a live call, the rep holds **SPACEBAR**.

Ghost:
1. Captures the mic stream in real time
2. Transcribes the objection via ElevenLabs STT
3. Classifies it into one of 5 types using NVIDIA Llama 3.3 70B
4. Generates a response styled after an elite sales coach
5. **Speaks the response back in the rep's own cloned voice** through the call

The prospect hears no gap. No robot. No fumble. Just the rep handling it perfectly.

**Ghost was never there.**

---

## Demo

> *Prospect says: "I think the price is a bit high for us."*
>
> Rep holds SPACE → releases →
>
> Ghost responds in rep's voice: *"That tells me the value isn't fully clear yet. Let me ask — what would it be worth to you if this solved the problem in 30 days?"*
>
> Prospect never knew.

---

## Architecture

```
SPACE held
    │
    ▼
Web Audio API (mic capture)
    │
    ▼
POST /api/ghost/takeover
    │
    ├─► ElevenLabs STT (scribe_v2)
    │       └─► transcript string
    │
    ├─► NVIDIA NIM Llama 3.3 70B
    │       └─► { objection_type, confidence, response }
    │
    └─► ElevenLabs TTS (Turbo v2.5)
            └─► audio/mpeg stream → browser → BlackHole → call
```

**Sub-2-second pipeline. End to end.**

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + Zustand |
| Backend | Node.js + Express |
| STT | ElevenLabs Scribe v2 |
| Voice Clone | ElevenLabs Instant Voice Clone |
| TTS | ElevenLabs Turbo v2.5 (streaming) |
| LLM | NVIDIA NIM — Llama 3.3 70B Instruct |
| Audio Routing | BlackHole 2ch (M1/M2 Mac) |
| Observability | PostHog LLM events |

---

## Features

**Core Pipeline**
- SPACEBAR hotkey trigger with key-repeat guard and ESC emergency cancel
- Real-time mic capture via Web Audio API
- ElevenLabs STT with direct `form-data` REST call
- NVIDIA Llama 3.3 70B objection classifier — strict JSON schema output
- ElevenLabs Turbo v2.5 streaming TTS in the rep's cloned voice
- Audio routed to BlackHole → call app hears it as the rep's microphone

**Voice Profiles**
- Up to 3 rep profiles per workspace
- One-sentence voice clone onboarding (30 seconds of audio)
- Per-profile coach persona preference

**3 Coach Personas**
- **Alex Hormozi** — direct, urgency-first, value/ROI framing
- **Chris Voss** — FBI negotiation, tactical empathy, labeling
- **Grant Cardone** — high-energy, follow-up pressure, 10X close

**5 Objection Types**
- Stall · Price · Authority · Timing · Competitor

**Hardening**
- Demo run-through checker with 5-step verification
- Graceful fallbacks at every external API boundary

**Post-Call Debrief**
- Full session transcript and objection log
- AI-generated 3-bullet call summary
- Latency metrics per objection
- JSON export

---

## Quick Start

### Prerequisites

- Node.js 20+
- ElevenLabs API key — [elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys)
- NVIDIA NIM API key — [build.nvidia.com](https://build.nvidia.com) → any model → Get API Key
- BlackHole 2ch (M1/M2 Mac) — `brew install blackhole-2ch`
- Chrome browser (required for `setSinkId` audio routing)

### Installation

```bash
# Clone the repo
git clone https://github.com/adirathoreudr/ghostProject
cd ghostProject

# Install all dependencies (root, client and server)
npm run install:all

# Set up environment (.env lives in the repo root)
cp .env.example .env
```

Edit `.env`:

```env
ELEVENLABS_API_KEY=your_elevenlabs_key
NVIDIA_API_KEY=nvapi-your_nvidia_key
POSTHOG_API_KEY=your_posthog_key        # optional
```

```bash
# Start everything
npm run dev
```

Open `http://localhost:5173`

### Audio Routing Setup (M2 Mac)

1. Open **Audio MIDI Setup** (Spotlight → Audio MIDI Setup)
2. `+` → **Create Multi-Output Device**
3. Check: **MacBook Speakers** + **BlackHole 2ch**
4. Right-click → **Use This Device For Sound Output**
5. In your call app (Zoom/Meet): set **Microphone → BlackHole 2ch**
6. In Ghost: sidebar → **Audio Output → BlackHole 2ch**

---

## Usage

```
1. Open Ghost → create a voice profile (30s recording)
2. Click "Demo Check" → verify all 5 checks pass
3. Click "Launch Ghost" → you land on the live call page
4. Join your call in another tab
5. When prospect says an objection → hold SPACE
6. Speak the objection or let it come through mic
7. Release SPACE → Ghost processes and responds in your voice
8. ESC at any time to cancel
9. End Call → review the debrief
```

---

## Project Structure

```
ghost/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # GhostOverlay, LiveCaptions, DemoMode, AudioDeviceSelector
│   │   ├── hooks/           # useGhostTakeover, useAudioRecorder
│   │   ├── pages/           # Dashboard, Onboarding, Call, Debrief
│   │   ├── stores/          # ghostStore, profileStore (Zustand)
│   │   └── lib/             # api.js, utils.js
│   └── tests/               # node:test suites for stores and API helpers
│
└── server/                  # Node.js backend
    ├── src/
    │   ├── app.js           # Express app (index.js starts it)
    │   ├── lib/             # stt.js, tts.js, classifier.js, posthog.js
    │   └── routes/          # ghost.js, voice.js, debrief.js, health.js
    └── tests/               # node:test suites with mocked ElevenLabs/NVIDIA
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ELEVENLABS_API_KEY` | ✅ | ElevenLabs API key for STT, TTS, voice clone |
| `NVIDIA_API_KEY` | ✅ | NVIDIA NIM key for Llama 3.3 70B |
| `POSTHOG_API_KEY` | Optional | PostHog project key for observability |
| `POSTHOG_HOST` | Optional | PostHog host (default: `https://us.i.posthog.com`) |
| `PORT` | Optional | Server port (default: 3001) |

Put these in `.env` at the repo root (see `.env.example`). `server/.env` is still read as a fallback.

---

## Latency Profile

| Step | Target | Notes |
|---|---|---|
| STT transcription | ~400ms | ElevenLabs Scribe v1 REST |
| LLM classify + response | ~600ms | NVIDIA NIM Llama 3.3 70B |
| TTS first audio chunk | ~700ms | ElevenLabs Turbo v2.5 streaming |
| Audio routing | ~100ms | BlackHole near-zero |
| **Total** | **~1.8s** | |

---

## Running Tests

```bash
npm test          # server + client suites (Node's built-in test runner)
npm run build     # production build of the client
```

The server tests mock ElevenLabs and NVIDIA, so they need no API keys or network access. CI runs both on Node 20 and 22.

---

## Deployment

Ghost is meant to run **locally**, on the same Mac you take calls from. Deploying it to Vercel (or any public host) is not recommended:

- The core trick needs local hardware: your microphone, the BlackHole virtual audio device and Chrome's `setSinkId`. A hosted copy can't reach any of these.
- The API routes have no authentication. A public URL would let anyone spend your ElevenLabs and NVIDIA credits or clone voices on your account.
- Voice profiles are stored in your browser's localStorage, so there is nothing to share between machines anyway.

If you ever want a public demo, put it behind authentication first.

---

## Built At

**ElevenLabs Worldwide Hackathon #9**

Built solo in 48 hours for the ElevenLabs Hack!

---

<div align="center">

*Ghost. The invisible closer.*

**[ElevenLabs](https://elevenlabs.io) · [NVIDIA NIM](https://build.nvidia.com) · [PostHog](https://posthog.com)**

</div>

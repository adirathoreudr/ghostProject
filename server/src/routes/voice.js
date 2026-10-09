import { Router } from 'express';
import multer from 'multer';
import { Readable } from 'node:stream';
import { captureEvent } from '../lib/posthog.js';
import { getVoiceProvider, voiceBackend } from '../lib/voiceProvider.js';
import { createLocalVoice, deleteLocalVoice } from '../lib/localVoice.js';
import { synthesizeFree } from '../lib/tts.js';

export const voiceRouter = Router();

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';

// Store audio in memory — no disk writes needed
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      const err = new Error(`Unsupported audio type: ${file.mimetype}`);
      err.status = 400;
      err.code = 'UNSUPPORTED_AUDIO';
      cb(err);
    }
  },
});

/**
 * POST /api/voice/clone
 * Body: multipart/form-data
 *   - audio: audio file blob
 *   - name: string (rep name for the voice)
 *   - description?: string
 */
voiceRouter.post('/clone', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No audio file provided',
        code: 'NO_AUDIO',
      });
    }

    const name = req.body.name?.trim() || 'Ghost Rep';

    if (getVoiceProvider() === 'free') {
      console.log(`[Voice Clone] Creating local clone for: "${name}" | ${req.file.size} bytes`);
      const voiceId = await createLocalVoice(req.file.buffer, name);
      console.log(`[Voice Clone] ✅ Created voice_id: ${voiceId}`);
      captureEvent(name, 'voice_clone_created', { voice_id: voiceId, rep_name: name, provider: 'free' });
      return res.json({ success: true, voice_id: voiceId, name });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'ElevenLabs API key not configured',
        code: 'ELEVENLABS_NOT_CONFIGURED',
      });
    }

    const description = req.body.description?.trim() || `Voice clone for ${name} — Ghost Sales Co-Pilot`;
    const mimeType = baseMimeType(req.file.mimetype);

    console.log(`[Voice Clone] Creating clone for: "${name}" | Audio size: ${req.file.size} bytes | Type: ${req.file.mimetype}`);

    // Build FormData for ElevenLabs Instant Voice Clone API
    const form = new FormData();
    form.append('name', `Ghost — ${name}`);
    form.append('description', description);
    form.append('labels', JSON.stringify({ app: 'ghost', rep: name }));
    form.append(
      'files',
      new Blob([req.file.buffer], { type: mimeType }),
      `voice_sample.${getExtension(mimeType)}`
    );

    const response = await fetch(`${ELEVENLABS_API}/voices/add`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[Voice Clone] ElevenLabs error:', data);
      return res.status(response.status).json({
        error: errorDetail(data, 'ElevenLabs voice clone failed'),
        code: 'ELEVENLABS_ERROR',
        details: data,
      });
    }

    console.log(`[Voice Clone] ✅ Created voice_id: ${data.voice_id}`);

    // Fire PostHog event
    captureEvent(name, 'voice_clone_created', {
      voice_id: data.voice_id,
      rep_name: name,
      audio_size_bytes: req.file.size,
      audio_type: req.file.mimetype,
    });

    res.json({
      success: true,
      voice_id: data.voice_id,
      name: data.name,
    });

  } catch (err) {
    console.error('[Voice Clone] Error:', err.message);
    res.status(err.status || 500).json({
      error: err.message,
      code: err.code || 'SERVER_ERROR',
    });
  }
});

/**
 * DELETE /api/voice/clone/:voiceId
 * Deletes a voice clone from ElevenLabs when a profile is deleted
 */
voiceRouter.delete('/clone/:voiceId', async (req, res) => {
  try {
    const { voiceId } = req.params;
    const backend = voiceBackend(voiceId);
    if (backend === 'nvidia') return res.json({ success: true }); // stock voice, nothing to delete
    if (backend === 'local') {
      await deleteLocalVoice(voiceId);
      return res.json({ success: true });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'ElevenLabs not configured' });
    }

    const response = await fetch(`${ELEVENLABS_API}/voices/${encodeURIComponent(voiceId)}`, {
      method: 'DELETE',
      headers: { 'xi-api-key': apiKey },
    });

    if (response.ok) {
      res.json({ success: true });
    } else {
      const data = await response.json().catch(() => ({}));
      res.status(response.status).json({ error: errorDetail(data, 'Delete failed') });
    }
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

/**
 * GET /api/voice/test-tts/:voiceId
 * Quick TTS test to verify a cloned voice sounds right
 */
const TEST_TEXT = "Ghost is ready. I help people solve problems and I close deals.";

voiceRouter.get('/test-tts/:voiceId', async (req, res) => {
  try {
    const { voiceId } = req.params;
    if (voiceBackend(voiceId) !== 'elevenlabs') {
      const { audio } = await synthesizeFree(TEST_TEXT, voiceId);
      res.set({ 'Content-Type': 'audio/wav', 'Cache-Control': 'no-cache' });
      return res.end(audio);
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'ElevenLabs not configured' });

    const response = await fetch(`${ELEVENLABS_API}/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: TEST_TEXT,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.85,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: errorDetail(data, 'TTS failed') });
    }

    res.set({
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache',
    });
    Readable.fromWeb(response.body).pipe(res);

  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

// "audio/webm;codecs=opus" → "audio/webm"
function baseMimeType(mimeType = '') {
  return mimeType.split(';')[0].trim().toLowerCase();
}

function getExtension(mimeType) {
  const map = {
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/x-m4a': 'm4a',
  };
  return map[baseMimeType(mimeType)] || 'webm';
}

// ElevenLabs errors come back as { detail: string | { message } | [{ msg }] }.
function errorDetail(data, fallback) {
  const detail = data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg || JSON.stringify(d)).join('; ');
  return detail?.message || fallback;
}

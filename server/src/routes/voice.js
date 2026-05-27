import { Router } from 'express';
import multer from 'multer';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { captureEvent } from '../lib/posthog.js';

export const voiceRouter = Router();

// Store audio in memory — no disk writes needed
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/webm', 'audio/wav', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/x-m4a'];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio type: ${file.mimetype}`));
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
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'ElevenLabs API key not configured',
        code: 'ELEVENLABS_NOT_CONFIGURED',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'No audio file provided',
        code: 'NO_AUDIO',
      });
    }

    const name = req.body.name?.trim() || 'Ghost Rep';
    const description = req.body.description?.trim() || `Voice clone for ${name} — Ghost Sales Co-Pilot`;

    console.log(`[Voice Clone] Creating clone for: "${name}" | Audio size: ${req.file.size} bytes | Type: ${req.file.mimetype}`);

    // Build FormData for ElevenLabs Instant Voice Clone API
    const form = new FormData();
    form.append('name', `Ghost — ${name}`);
    form.append('description', description);
    form.append('labels', JSON.stringify({ app: 'ghost', rep: name }));
    form.append('files', req.file.buffer, {
      filename: `voice_sample.${getExtension(req.file.mimetype)}`,
      contentType: req.file.mimetype,
    });

    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        ...form.getHeaders(),
      },
      body: form,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Voice Clone] ElevenLabs error:', data);
      return res.status(response.status).json({
        error: data.detail?.message || data.detail || 'ElevenLabs voice clone failed',
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
    console.error('[Voice Clone] Unexpected error:', err);
    res.status(500).json({
      error: err.message,
      code: 'SERVER_ERROR',
    });
  }
});

/**
 * DELETE /api/voice/clone/:voiceId
 * Deletes a voice clone from ElevenLabs when a profile is deleted
 */
voiceRouter.delete('/clone/:voiceId', async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'ElevenLabs not configured' });
    }

    const { voiceId } = req.params;
    const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      method: 'DELETE',
      headers: { 'xi-api-key': apiKey },
    });

    if (response.ok) {
      res.json({ success: true });
    } else {
      const data = await response.json();
      res.status(response.status).json({ error: data.detail || 'Delete failed' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/voice/test-tts/:voiceId
 * Quick TTS test to verify a cloned voice sounds right
 */
voiceRouter.get('/test-tts/:voiceId', async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'ElevenLabs not configured' });

    const { voiceId } = req.params;
    const testText = "Ghost is ready. I help people solve problems and I close deals.";

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=3`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: testText,
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
      const data = await response.json();
      return res.status(response.status).json({ error: data.detail || 'TTS failed' });
    }

    res.set({
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache',
    });
    response.body.pipe(res);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getExtension(mimeType) {
  const map = {
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/x-m4a': 'm4a',
  };
  return map[mimeType] || 'webm';
}

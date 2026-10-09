import { Router } from 'express';
import multer from 'multer';
import { transcribeAudio } from '../lib/stt.js';
import { classifyObjection, normalizePersona } from '../lib/classifier.js';
import { streamTTS } from '../lib/tts.js';
import { captureEvent } from '../lib/posthog.js';
import { getVoiceProvider } from '../lib/voiceProvider.js';

export const ghostRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── POST /api/ghost/takeover ───────────────────────────────────────────────
ghostRouter.post('/takeover', upload.single('audio'), async (req, res) => {
  const pipelineStart = Date.now();
  const { voice_id, profile_name = 'unknown', mime_type, conversation_id } = req.body;
  // Persona ends up in a response header, so only known values are allowed through.
  const persona = normalizePersona(req.body.persona);

  console.log(`\n[Ghost] ══════════════════════════════════════════`);
  console.log(`[Ghost] TAKEOVER | rep: ${profile_name} | persona: ${persona}`);

  if (!req.file)  return res.status(400).json({ error: 'No audio',             code: 'NO_AUDIO' });
  if (!voice_id)  return res.status(400).json({ error: 'voice_id required',    code: 'NO_VOICE_ID' });
  if (getVoiceProvider() === 'elevenlabs' && !process.env.ELEVENLABS_API_KEY)
    return res.status(503).json({ error: 'ElevenLabs not configured',          code: 'ELEVENLABS_MISSING' });
  if (!process.env.NVIDIA_API_KEY)
    return res.status(503).json({ error: 'NVIDIA API key not configured',      code: 'NVIDIA_MISSING' });

  const audioMime = mime_type || req.file.mimetype || 'audio/webm';
  console.log(`[Ghost] Audio: ${req.file.size} bytes | mime: ${audioMime}`);

  try {
    // Step 1: STT
    console.log('[Ghost] Step 1: STT');
    let transcript;
    try {
      transcript = await transcribeAudio(req.file.buffer, audioMime);
    } catch (err) {
      console.error('[Ghost] STT failed:', err.message);
      return res.status(422).json({ error: `Transcription failed: ${err.message}`, code: 'STT_FAILED', step: 'stt' });
    }

    // Step 2: Classify
    console.log('[Ghost] Step 2: Classify');
    let classification;
    try {
      classification = await classifyObjection(transcript, persona);
    } catch (err) {
      console.error('[Ghost] Classify failed:', err.message);
      return res.status(422).json({ error: `Classification failed: ${err.message}`, code: 'CLASSIFY_FAILED', step: 'classify', transcript });
    }

    const { objection_type, confidence, response: responseText, latency_ms: classifyMs } = classification;

    // Step 3: TTS stream
    console.log('[Ghost] Step 3: TTS');
    const ttsStart = Date.now();

    res.set({
      'X-Ghost-Transcript':      encodeURIComponent(transcript),
      'X-Ghost-Objection-Type':  objection_type,
      'X-Ghost-Confidence':      String(confidence),
      'X-Ghost-Response-Text':   encodeURIComponent(responseText),
      'X-Ghost-Persona':         persona,
      'X-Ghost-Classify-Ms':     String(classifyMs),
      'X-Ghost-Conversation-Id': encodeURIComponent(conversation_id || ''),
    });

    try {
      await streamTTS(responseText, voice_id, res);
    } catch (err) {
      // SDK errors carry the ElevenLabs reason in body.detail; the message is just the status.
      const reason = err.body?.detail?.message || err.body?.detail || err.message;
      console.error('[Ghost] TTS failed:', reason);
      if (!res.headersSent) {
        return res.status(422).json({ error: `TTS failed: ${reason}`, code: 'TTS_FAILED', step: 'tts', transcript, classification });
      }
      // Audio already started streaming — abort so the client isn't left waiting.
      res.destroy(err);
      return;
    }

    const totalMs = Date.now() - pipelineStart;
    console.log(`[Ghost] ✅ COMPLETE | ${totalMs}ms | ${objection_type} | ${(confidence*100).toFixed(0)}%`);
    console.log(`[Ghost] ══════════════════════════════════════════\n`);

    captureEvent(profile_name, 'ghost_takeover', {
      rep_name: profile_name, persona, objection_type, confidence,
      transcript, response_text: responseText,
      total_latency_ms: totalMs, classify_latency_ms: classifyMs,
      tts_latency_ms: Date.now() - ttsStart,
      audio_size_bytes: req.file.size,
      conversation_id: conversation_id || null,
    });

  } catch (err) {
    console.error('[Ghost] Pipeline error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message, code: 'PIPELINE_ERROR' });
  }
});

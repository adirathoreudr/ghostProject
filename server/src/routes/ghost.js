import { Router } from 'express';
import multer from 'multer';
import { transcribeAudio } from '../lib/stt.js';
import { classifyObjection } from '../lib/classifier.js';
import { streamTTS, bufferTTS } from '../lib/tts.js';
import { captureEvent } from '../lib/posthog.js';

export const ghostRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── POST /api/ghost/takeover ───────────────────────────────────────────────
ghostRouter.post('/takeover', upload.single('audio'), async (req, res) => {
  const pipelineStart = Date.now();
  const { voice_id, persona = 'hormozi', profile_name = 'unknown', mime_type, conversation_id } = req.body;

  console.log(`\n[Ghost] ══════════════════════════════════════════`);
  console.log(`[Ghost] TAKEOVER | rep: ${profile_name} | persona: ${persona}`);

  if (!req.file)  return res.status(400).json({ error: 'No audio',             code: 'NO_AUDIO' });
  if (!voice_id)  return res.status(400).json({ error: 'voice_id required',    code: 'NO_VOICE_ID' });
  if (!process.env.ELEVENLABS_API_KEY)
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
      'X-Ghost-Conversation-Id': conversation_id || '',
    });

    try {
      await streamTTS(responseText, voice_id, res);
    } catch (err) {
      console.error('[Ghost] TTS failed:', err.message);
      if (!res.headersSent) {
        return res.status(422).json({ error: `TTS failed: ${err.message}`, code: 'TTS_FAILED', step: 'tts', transcript, classification });
      }
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

// ── POST /api/ghost/classify-only ─────────────────────────────────────────
ghostRouter.post('/classify-only', upload.single('audio'), async (req, res) => {
  const { persona = 'hormozi', mime_type } = req.body;
  if (!req.file) return res.status(400).json({ error: 'No audio' });
  try {
    const transcript     = await transcribeAudio(req.file.buffer, mime_type || req.file.mimetype);
    const classification = await classifyObjection(transcript, persona);
    res.json({ transcript, classification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ghost/prewarm ───────────────────────────────────────────────
// Returns base64-encoded audio blobs per objection type for client-side caching.
ghostRouter.post('/prewarm', async (req, res) => {
  const { voice_id, persona = 'hormozi' } = req.body;
  if (!voice_id) return res.status(400).json({ error: 'voice_id required' });

  const PREWARM_SCRIPTS = {
    stall: {
      hormozi: "Here's the thing — not deciding is a decision. Every week you wait, the problem is costing you. What would it take to make this a yes today?",
      voss:    "It sounds like you need more time to feel comfortable. What would need to be true for you to feel ready?",
      cardone: "I hear that. Every client who waited six months told me they wished they started sooner. Are you in or are you out?",
    },
    price: {
      hormozi: "Let me show you the math. If this solves the problem, what's that worth to you per month? The investment pays for itself.",
      voss:    "It seems like the price feels uncertain. What is it about the investment that concerns you most?",
      cardone: "The price isn't the issue — the issue is whether you want to solve this. What's it costing you not to fix this?",
    },
    authority: {
      hormozi: "Totally. Let's get them on a quick call together — I'll make the case in ten minutes. When works this week?",
      voss:    "It sounds like you want to make sure everyone is aligned. What would make it easy for them to say yes?",
      cardone: "Bring them in. I'll close them both at once. When can we do a three-way call?",
    },
    timing: {
      hormozi: "The timing is never perfect. The question is whether the problem goes away on its own. It doesn't. What changes next quarter?",
      voss:    "It sounds like the timing feels off. What would need to change for this to be the right moment?",
      cardone: "There is no right time. There's only now. The people who wait are the ones who stay stuck.",
    },
    competitor: {
      hormozi: "Smart to compare. Here's what I'd ask them — can they guarantee the outcome? We can. That's the difference.",
      voss:    "It sounds like you're weighing your options carefully. What would the other solution need to do that we don't?",
      cardone: "Compare all you want. At the end of the day, you're here talking to me for a reason. What would make this a clear yes?",
    },
  };

  const results = [];
  const audioCache = {};

  const objTypes = ['stall', 'price', 'authority', 'timing', 'competitor'];

  for (const objType of objTypes) {
    const script = PREWARM_SCRIPTS[objType]?.[persona] || PREWARM_SCRIPTS[objType]?.hormozi;
    try {
      const start = Date.now();
      const buffer = await bufferTTS(script, voice_id);
      const b64 = buffer.toString('base64');
      audioCache[objType] = b64;
      results.push({ objType, latency_ms: Date.now() - start, ok: true, size: buffer.length });
      console.log(`[Prewarm] ✅ ${objType} | ${Date.now() - start}ms | ${buffer.length} bytes`);
    } catch (err) {
      results.push({ objType, error: err.message, ok: false });
      console.warn(`[Prewarm] ⚠️  ${objType} failed: ${err.message}`);
    }
  }

  const successCount = results.filter(r => r.ok).length;
  console.log(`[Prewarm] Complete: ${successCount}/${objTypes.length} cached`);

  res.json({ persona, voice_id, results, audioCache });
});

import { Router } from 'express';
import fetch from 'node-fetch';

export const engineRouter = Router();

/**
 * POST /api/engine/create
 * Creates an ElevenLabs Speech Engine instance.
 * Must be called AFTER ngrok is running so wss_url is available.
 * Returns engine_id which should be stored on the client.
 */
engineRouter.post('/create', async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'ElevenLabs API key not configured',
        code: 'ELEVENLABS_NOT_CONFIGURED',
      });
    }

    const ngrokUrl = process.env.NGROK_URL;
    if (!ngrokUrl) {
      return res.status(400).json({
        error: 'NGROK_URL not set in .env. Run ngrok first.',
        code: 'NGROK_NOT_CONFIGURED',
      });
    }

    // Convert https:// → wss://
    const wsUrl = ngrokUrl.replace(/^https?:\/\//, 'wss://') + '/ws';

    console.log(`[Engine] Creating Speech Engine with wsUrl: ${wsUrl}`);

    const response = await fetch('https://api.elevenlabs.io/v1/speech-engine', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Ghost Sales Co-Pilot',
        speech_engine: { ws_url: wsUrl },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Engine] ElevenLabs error:', data);
      return res.status(response.status).json({
        error: data.detail?.message || data.detail || 'Speech Engine creation failed',
        code: 'ELEVENLABS_ERROR',
        details: data,
      });
    }

    console.log(`[Engine] ✅ Created engine_id: ${data.engine_id}`);
    res.json({ success: true, engine_id: data.engine_id });

  } catch (err) {
    console.error('[Engine] Unexpected error:', err);
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/engine/status
 * Returns current engine config for UI display
 */
engineRouter.get('/status', (req, res) => {
  res.json({
    ngrok_url: process.env.NGROK_URL || null,
    ngrok_configured: !!process.env.NGROK_URL,
    elevenlabs_configured: !!process.env.ELEVENLABS_API_KEY,
    anthropic_configured: !!process.env.ANTHROPIC_API_KEY,
  });
});

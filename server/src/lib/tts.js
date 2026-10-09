import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

let _client = null;

function getClient() {
  if (!_client) {
    if (!process.env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not set');
    _client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
  }
  return _client;
}

// SDK v2 expects camelCase request fields and silently strips unknown keys,
// so snake_case options would fall back to the (slower, pricier) default model.
const TTS_OPTIONS = {
  modelId: 'eleven_turbo_v2_5',
  outputFormat: 'mp3_44100_128',
  voiceSettings: {
    stability: 0.45,
    similarityBoost: 0.88,
    style: 0.15,
    useSpeakerBoost: true,
  },
};

/**
 * Stream TTS audio for a given text and voice_id.
 * Pipes the audio stream directly into an Express response.
 *
 * @param {string} text - Text to synthesize
 * @param {string} voiceId - ElevenLabs voice_id from the cloned profile
 * @param {import('express').Response} res - Express response to pipe into
 */
export async function streamTTS(text, voiceId, res) {
  const client = getClient();

  console.log(`[TTS] Streaming for voice_id: ${voiceId} | Text: "${text.slice(0, 60)}..."`);
  const startMs = Date.now();

  const audioStream = await client.textToSpeech.stream(voiceId, { text, ...TTS_OPTIONS });

  // Set audio headers only once the upstream stream is open, so a failed
  // request above can still be answered with a JSON error.
  res.set({
    'Content-Type': 'audio/mpeg',
    'Cache-Control': 'no-cache, no-store',
    'X-Accel-Buffering': 'no',
  });

  let firstChunk = true;
  for await (const chunk of audioStream) {
    if (firstChunk) {
      console.log(`[TTS] First audio chunk in ${Date.now() - startMs}ms`);
      firstChunk = false;
    }
    res.write(chunk);
  }

  res.end();
  console.log(`[TTS] ✅ Complete in ${Date.now() - startMs}ms`);
}

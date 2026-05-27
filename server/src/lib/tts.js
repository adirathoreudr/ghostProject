import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

let _client = null;

function getClient() {
  if (!_client) {
    if (!process.env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not set');
    _client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
  }
  return _client;
}

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

  res.set({
    'Content-Type': 'audio/mpeg',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache, no-store',
    'X-Accel-Buffering': 'no',
  });

  const audioStream = await client.textToSpeech.stream(voiceId, {
    text,
    model_id: 'eleven_turbo_v2_5',
    voice_settings: {
      stability: 0.45,
      similarity_boost: 0.88,
      style: 0.15,
      use_speaker_boost: true,
    },
    output_format: 'mp3_44100_128',
    optimize_streaming_latency: 3, // max latency optimization
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

/**
 * Convert text to a full audio buffer (for pre-warming).
 * @param {string} text
 * @param {string} voiceId
 * @returns {Promise<Buffer>}
 */
export async function bufferTTS(text, voiceId) {
  const client = getClient();

  const audioStream = await client.textToSpeech.stream(voiceId, {
    text,
    model_id: 'eleven_turbo_v2_5',
    voice_settings: {
      stability: 0.45,
      similarity_boost: 0.88,
      style: 0.15,
      use_speaker_boost: true,
    },
    output_format: 'mp3_44100_128',
    optimize_streaming_latency: 3,
  });

  const chunks = [];
  for await (const chunk of audioStream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

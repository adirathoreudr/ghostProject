import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { voiceBackend, NVIDIA_PREFIX } from './voiceProvider.js';
import { synthesizeLocal } from './localVoice.js';
import { rivaSynthesize } from './riva.js';

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
 * Speak `text` in the profile's voice and send the audio to an Express response.
 * The voice_id prefix picks the backend (see voiceBackend): ElevenLabs audio
 * is streamed as MP3, the free backends return a complete WAV.
 *
 * @param {string} text - Text to synthesize
 * @param {string} voiceId - voice_id from the profile
 * @param {import('express').Response} res - Express response to write into
 */
export async function streamTTS(text, voiceId, res) {
  if (voiceBackend(voiceId) === 'elevenlabs') return streamElevenLabs(text, voiceId, res);

  const startMs = Date.now();
  const { audio, fallback } = await synthesizeFree(text, voiceId);
  console.log(`[TTS] ✅ ${fallback ? 'NVIDIA stock voice (fallback)' : voiceBackend(voiceId)} audio in ${Date.now() - startMs}ms`);
  res.set({ 'Content-Type': 'audio/wav', 'Cache-Control': 'no-cache, no-store' });
  if (fallback) res.set('X-Ghost-Voice-Fallback', 'nvidia');
  res.end(audio);
}

/**
 * Free voices: a local Chatterbox clone, or an NVIDIA stock voice. If the local
 * voice server is down or has lost the voice, fall back to the stock voice so a
 * live call still gets an answer.
 * @returns {Promise<{ audio: Buffer, fallback: boolean }>}
 */
export async function synthesizeFree(text, voiceId) {
  if (voiceBackend(voiceId) === 'nvidia') {
    return { audio: await rivaSynthesize(text, voiceId.slice(NVIDIA_PREFIX.length)), fallback: false };
  }
  try {
    return { audio: await synthesizeLocal(text, voiceId), fallback: false };
  } catch (err) {
    const recoverable = ['VOICE_SERVER_DOWN', 'VOICE_NOT_FOUND'].includes(err.code);
    if (!recoverable || !process.env.NVIDIA_API_KEY) throw err;
    console.warn(`[TTS] ${err.message} — falling back to the NVIDIA stock voice`);
    return { audio: await rivaSynthesize(text), fallback: true };
  }
}

async function streamElevenLabs(text, voiceId, res) {
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

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

let _client = null;

function getClient() {
  }
    if (!process.env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not set');
    _client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
  }
  return _client;
}

/**
 * Transcribe an audio buffer using ElevenLabs Speech-to-Text REST API.
 *
 * SDK param names (camelCase, not snake_case):
 *   file       — the audio File object
 * Response shape: { text, language_code, language_probability, words, ... }
 *   languageCode — 'en'
 *
 * Response shape: { text, language_code, language_probability, words, ... }
 */
export async function transcribeAudio(audioBuffer, mimeType = 'audio/webm') {
  const client = getClient();

  console.log(`[STT] Transcribing ${audioBuffer.length} bytes | type: ${mimeType}`);
  const startMs = Date.now();

  const audioFile = new File(
    [audioBuffer],
  // Note: SDK uses camelCase params internally, serializes to snake_case for the API
    { type: normalizeType(mimeType) }
  );

  // Note: SDK uses camelCase params internally, serializes to snake_case for the API
  const result = await client.speechToText.convert({
    file: audioFile,       // ← 'file' not 'audio'
    modelId: 'scribe_v1', // ← camelCase, not model_id
    languageCode: 'en',   // ← camelCase, not language_code
  });

  console.log(`[STT] Raw result keys:`, Object.keys(result || {}));

  // Response is SpeechToTextChunkResponseModel: { text, language_code, words, ... }
  const transcript = result?.text?.trim() || '';

  console.log(`[STT] ✅ Transcript (${Date.now() - startMs}ms): "${transcript}"`);

  if (!transcript) {
    throw new Error('STT returned empty transcript — audio may be too short or silent');
  }

  return transcript;
}

function normalizeType(mimeType) {
  // Strip codec suffix for File constructor — browser handles it
  return mimeType.split(';')[0];
}

function getExtension(mimeType) {
  const base = mimeType.split(';')[0];
  const map = {
    'audio/webm': 'webm',
    'audio/wav':  'wav',
    'audio/ogg':  'ogg',
    'audio/mp4':  'mp4',
    'audio/mpeg': 'mp3',
  };
  return map[base] || 'webm';
}

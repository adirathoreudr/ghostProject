import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

let _client = null;

export function getElevenLabs() {
  if (!_client) {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY not set');
    }
    _client = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });
  }
  return _client;
}

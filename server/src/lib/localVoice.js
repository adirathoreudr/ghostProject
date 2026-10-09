import { LOCAL_PREFIX } from './voiceProvider.js';

// HTTP client for the local Chatterbox voice server in voice-server/.
const DEFAULT_URL = 'http://127.0.0.1:8005';

function baseUrl() {
  return (process.env.VOICE_SERVER_URL || DEFAULT_URL).replace(/\/+$/, '');
}

async function request(path, init, timeoutMs) {
  let res;
  try {
    res = await fetch(`${baseUrl()}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const timedOut = err.name === 'TimeoutError';
    const e = new Error(timedOut
      ? `Local voice server at ${baseUrl()} timed out`
      : `Local voice server not reachable at ${baseUrl()} — start it with "npm run voice:start"`);
    e.code = timedOut ? 'VOICE_SERVER_TIMEOUT' : 'VOICE_SERVER_DOWN';
    e.status = 503;
    throw e;
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = Array.isArray(data.detail) ? data.detail.map(d => d.msg).join('; ') : data.detail;
    const e = new Error(detail || `Local voice server error ${res.status}`);
    e.status = res.status;
    e.code = res.status === 404 ? 'VOICE_NOT_FOUND' : 'VOICE_SERVER_ERROR';
    throw e;
  }
  return res;
}

const stripPrefix = (voiceId) => voiceId.slice(LOCAL_PREFIX.length);

/** Returns the voice server's /health payload, or null if it isn't running. */
export async function localVoiceHealth() {
  try {
    return await (await request('/health', {}, 1500)).json();
  } catch {
    return null;
  }
}

/** Register a WAV reference recording as a new cloned voice. Returns "local:<id>". */
export async function createLocalVoice(wavBuffer, name) {
  const form = new FormData();
  form.append('audio', new Blob([wavBuffer], { type: 'audio/wav' }), 'voice_sample.wav');
  form.append('name', name);
  const data = await (await request('/voices', { method: 'POST', body: form }, 30000)).json();
  return `${LOCAL_PREFIX}${data.voice_id}`;
}

export async function deleteLocalVoice(voiceId) {
  await request(`/voices/${encodeURIComponent(stripPrefix(voiceId))}`, { method: 'DELETE' }, 10000);
}

/** Speak `text` in a locally cloned voice. Returns WAV audio. */
export async function synthesizeLocal(text, voiceId) {
  const res = await request('/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice_id: stripPrefix(voiceId) }),
  }, 120000); // CPU-only machines can take a while per sentence
  return Buffer.from(await res.arrayBuffer());
}

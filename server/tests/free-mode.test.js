import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mockFetch, restoreFetch, jsonResponse, startApp } from './helpers.js';
import { startFakeRiva, startFakeVoiceServer } from './fakes.js';
import { pcmToWav, parseWav } from '../src/lib/wav.js';

let app, riva, voice;
before(async () => {
  riva = await startFakeRiva();
  voice = await startFakeVoiceServer();
  app = await startApp();
});
after(async () => { await app.close(); await riva.close(); await voice.close(); });
beforeEach(() => {
  process.env.VOICE_PROVIDER = 'free';
  process.env.NVIDIA_API_KEY = 'nvapi-test';
  process.env.NVIDIA_RIVA_ENDPOINT = riva.endpoint;
  process.env.VOICE_SERVER_URL = voice.url;
  delete process.env.ELEVENLABS_API_KEY;
});
afterEach(restoreFetch);

const LLM = () => jsonResponse({ choices: [{ message: { content: '{"objection_type":"competitor","confidence":0.88,"response":"Smart to compare. What would they need to do that we do not?"}' } }] });
const wavForm = (fields, audio = pcmToWav(Buffer.alloc(32000, 3), 16000), type = 'audio/wav') => {
  const form = new FormData();
  form.append('audio', new Blob([audio], { type }), 'objection.wav');
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return form;
};

async function cloneVoice(name = 'Ana') {
  const form = new FormData();
  form.append('audio', new Blob([pcmToWav(Buffer.alloc(24000 * 2 * 8), 24000)], { type: 'audio/wav' }), 'voice_sample.wav');
  form.append('name', name);
  return fetch(`${app.url}/api/voice/clone`, { method: 'POST', body: form });
}

test('health reports free mode and the local voice server', async () => {
  const data = await (await fetch(`${app.url}/api/health`)).json();
  assert.deepEqual(data.env, { voice_provider: 'free', voice_server: true, nvidia: true, posthog: false });
});

test('cloning in free mode creates a local voice without ElevenLabs', async () => {
  const calls = mockFetch(() => new Response('unexpected', { status: 599 }));
  const res = await cloneVoice('Ana');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.match(data.voice_id, /^local:a{31}\d$/);
  assert.equal(calls.length, 0);
  const upload = voice.calls.find(c => c.url === '/voices').form;
  assert.equal(upload.get('name'), 'Ana');
  assert.equal(upload.get('audio').type, 'audio/wav');
});

test('takeover in free mode: Riva STT → classifier → cloned voice', async () => {
  const voiceId = (await (await cloneVoice()).json()).voice_id;
  const calls = mockFetch(LLM);
  const res = await fetch(`${app.url}/api/ghost/takeover`, { method: 'POST', body: wavForm({ voice_id: voiceId, mime_type: 'audio/wav' }) });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'audio/wav');
  assert.equal(res.headers.get('x-ghost-voice-fallback'), null);
  assert.equal(decodeURIComponent(res.headers.get('x-ghost-transcript')), 'We are already using another vendor');
  assert.equal(res.headers.get('x-ghost-objection-type'), 'competitor');
  assert.equal(parseWav(Buffer.from(await res.arrayBuffer())).sampleRate, 24000);

  assert.equal(calls.length, 1, 'only the NVIDIA LLM is called over HTTP');
  assert.equal(calls[0].url.hostname, 'integrate.api.nvidia.com');
  const tts = JSON.parse(voice.calls.findLast(c => c.url === '/tts').body);
  assert.equal(`local:${tts.voice_id}`, voiceId);
  assert.equal(tts.text, 'Smart to compare. What would they need to do that we do not?');
});

test('takeover falls back to the NVIDIA stock voice if the local voice is gone', async () => {
  mockFetch(LLM);
  const before = riva.calls.filter(c => c.method === 'Synthesize').length;
  const res = await fetch(`${app.url}/api/ghost/takeover`, { method: 'POST', body: wavForm({ voice_id: 'local:deadbeef' }) });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-ghost-voice-fallback'), 'nvidia');
  assert.equal(parseWav(Buffer.from(await res.arrayBuffer())).sampleRate, 44100);
  assert.equal(riva.calls.filter(c => c.method === 'Synthesize').length, before + 1);
});

test('takeover falls back when the voice server is not running', async () => {
  process.env.VOICE_SERVER_URL = 'http://127.0.0.1:9'; // nothing listens on the discard port
  mockFetch(LLM);
  const res = await fetch(`${app.url}/api/ghost/takeover`, { method: 'POST', body: wavForm({ voice_id: 'local:abc' }) });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-ghost-voice-fallback'), 'nvidia');
  await res.arrayBuffer();
});

test('nvidia: voices use Magpie directly', async () => {
  mockFetch(LLM);
  const res = await fetch(`${app.url}/api/ghost/takeover`, { method: 'POST', body: wavForm({ voice_id: 'nvidia:Magpie-Multilingual.EN-US.Ray' }) });
  assert.equal(res.status, 200);
  await res.arrayBuffer();
  assert.equal(riva.calls.at(-1).request.voice_name, 'Magpie-Multilingual.EN-US.Ray');
});

test('free mode asks for WAV when it receives another format', async () => {
  mockFetch(LLM);
  const res = await fetch(`${app.url}/api/ghost/takeover`, {
    method: 'POST',
    body: wavForm({ voice_id: 'local:abc' }, new Uint8Array(4096).fill(1), 'audio/webm'),
  });
  assert.equal(res.status, 422);
  const data = await res.json();
  assert.equal(data.code, 'STT_FAILED');
  assert.match(data.error, /needs WAV/);
});

test('clone reports a stopped voice server clearly', async () => {
  process.env.VOICE_SERVER_URL = 'http://127.0.0.1:9';
  const res = await cloneVoice();
  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.code, 'VOICE_SERVER_DOWN');
  assert.match(data.error, /npm run voice:start/);
});

test('test-tts and delete work for local voices', async () => {
  const voiceId = (await (await cloneVoice()).json()).voice_id;
  let res = await fetch(`${app.url}/api/voice/test-tts/${encodeURIComponent(voiceId)}`);
  assert.equal(res.headers.get('content-type'), 'audio/wav');
  await res.arrayBuffer();

  res = await fetch(`${app.url}/api/voice/clone/${encodeURIComponent(voiceId)}`, { method: 'DELETE' });
  assert.equal(res.status, 200);
  assert.equal(voice.voices.has(voiceId.slice('local:'.length)), false);

  res = await fetch(`${app.url}/api/voice/clone/${encodeURIComponent('nvidia:Magpie-Multilingual.EN-US.Aria')}`, { method: 'DELETE' });
  assert.equal(res.status, 200);
});

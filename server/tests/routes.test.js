import { test, before, after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mockFetch, restoreFetch, jsonResponse, startApp, takeoverForm, upstream,
} from './helpers.js';

let app;
before(async () => { app = await startApp(); });
after(() => app.close());
beforeEach(() => {
  process.env.ELEVENLABS_API_KEY = 'xi-test';
  process.env.NVIDIA_API_KEY = 'nvapi-test';
});
afterEach(restoreFetch);

const takeover = (form) => fetch(`${app.url}/api/ghost/takeover`, { method: 'POST', body: form });

test('GET /api/health reports configured keys', async () => {
  delete process.env.POSTHOG_API_KEY;
  const res = await fetch(`${app.url}/api/health`);
  const data = await res.json();
  assert.equal(data.status, 'ok');
  assert.deepEqual(data.env, { voice_provider: 'elevenlabs', elevenlabs: true, nvidia: true, posthog: false });
});

test('removed hackathon endpoints are gone', async () => {
  for (const [method, path] of [['POST', '/api/engine/create'], ['POST', '/api/ghost/prewarm'], ['POST', '/api/ghost/classify-only']]) {
    const res = await fetch(`${app.url}${path}`, { method });
    assert.equal(res.status, 404, path);
  }
});

test('takeover validates audio and voice_id', async () => {
  let res = await takeover(takeoverForm({ voice_id: 'v1' }, null));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, 'NO_AUDIO');

  res = await takeover(takeoverForm({}));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, 'NO_VOICE_ID');
});

test('takeover reports missing API keys', async () => {
  delete process.env.NVIDIA_API_KEY;
  const res = await takeover(takeoverForm({ voice_id: 'v1' }));
  assert.equal(res.status, 503);
  assert.equal((await res.json()).code, 'NVIDIA_MISSING');
});

test('takeover runs STT → classify → TTS and streams audio with metadata headers', async () => {
  const calls = mockFetch(upstream());
  const res = await takeover(takeoverForm({
    voice_id: 'voice-abc', persona: 'voss', profile_name: 'Ana', mime_type: 'audio/webm;codecs=opus', conversation_id: 'conv 1',
  }));

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'audio/mpeg');
  assert.equal(decodeURIComponent(res.headers.get('x-ghost-transcript')), 'The price is too high for us');
  assert.equal(res.headers.get('x-ghost-objection-type'), 'price');
  assert.equal(res.headers.get('x-ghost-confidence'), '0.92');
  assert.equal(res.headers.get('x-ghost-persona'), 'voss');
  assert.equal(decodeURIComponent(res.headers.get('x-ghost-conversation-id')), 'conv 1');
  assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [9, 9, 9]);

  const stt = calls.find(c => c.url.pathname.endsWith('/speech-to-text'));
  assert.equal(stt.body.get('model_id'), 'scribe_v2');

  const tts = calls.find(c => c.url.pathname.includes('/text-to-speech/'));
  assert.match(tts.url.pathname, /voice-abc\/stream$/);
  const ttsBody = JSON.parse(tts.body);
  assert.equal(ttsBody.model_id, 'eleven_turbo_v2_5');
  assert.equal(ttsBody.text, 'What would it cost you not to fix this?');

  const llm = JSON.parse(calls.find(c => c.url.hostname === 'integrate.api.nvidia.com').body);
  assert.match(llm.messages[0].content, /Chris Voss/);
});

test('takeover with an unknown persona falls back to hormozi instead of crashing', async () => {
  mockFetch(upstream());
  const res = await takeover(takeoverForm({ voice_id: 'v1', persona: 'badé\nvalue' }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-ghost-persona'), 'hormozi');
  await res.arrayBuffer();
});

test('takeover returns a JSON error when TTS fails before audio starts', async () => {
  mockFetch(upstream({ tts: () => jsonResponse({ detail: { message: 'voice_not_found' } }, 404) }));
  const res = await takeover(takeoverForm({ voice_id: 'missing' }));
  assert.equal(res.status, 422);
  assert.match(res.headers.get('content-type'), /application\/json/);
  const data = await res.json();
  assert.equal(data.code, 'TTS_FAILED');
  assert.equal(data.step, 'tts');
  assert.equal(data.error, 'TTS failed: voice_not_found');
});

test('takeover reports classifier failures with the transcript', async () => {
  mockFetch(upstream({ llm: 'I cannot help with that.' }));
  const res = await takeover(takeoverForm({ voice_id: 'v1' }));
  assert.equal(res.status, 422);
  const data = await res.json();
  assert.equal(data.code, 'CLASSIFY_FAILED');
  assert.equal(data.transcript, 'The price is too high for us');
});

test('takeover aborts the response if TTS dies mid-stream', async () => {
  mockFetch(upstream({
    tts: () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        setTimeout(() => controller.error(new Error('socket hang up')), 20);
      },
    }), { headers: { 'content-type': 'audio/mpeg' } }),
  }));
  const res = await takeover(takeoverForm({ voice_id: 'v1' }));
  assert.equal(res.status, 200);
  await assert.rejects(res.arrayBuffer());
});

test('voice clone forwards a correctly named file to ElevenLabs', async () => {
  const calls = mockFetch(() => jsonResponse({ voice_id: 'new-voice', name: 'Ghost — Ana' }));
  const form = new FormData();
  form.append('audio', new Blob([new Uint8Array(4096)], { type: 'audio/mp4;codecs=mp4a.40.2' }), 'voice_sample.mp4');
  form.append('name', 'Ana');

  const res = await fetch(`${app.url}/api/voice/clone`, { method: 'POST', body: form });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).voice_id, 'new-voice');

  const sent = calls[0].body.get('files');
  assert.equal(sent.name, 'voice_sample.mp4');
  assert.equal(sent.type, 'audio/mp4');
  assert.equal(calls[0].headers.get('xi-api-key'), 'xi-test');
});

test('voice clone surfaces ElevenLabs validation errors as text', async () => {
  mockFetch(() => jsonResponse({ detail: [{ msg: 'files: field required' }] }, 422));
  const form = new FormData();
  form.append('audio', new Blob([new Uint8Array(10)], { type: 'audio/webm' }), 'a.webm');
  const res = await fetch(`${app.url}/api/voice/clone`, { method: 'POST', body: form });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).error, 'files: field required');
});

test('voice clone rejects non-audio uploads with 400 and oversize uploads with 413', async () => {
  let form = new FormData();
  form.append('audio', new Blob(['hi'], { type: 'text/plain' }), 'a.txt');
  let res = await fetch(`${app.url}/api/voice/clone`, { method: 'POST', body: form });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, 'UNSUPPORTED_AUDIO');

  form = new FormData();
  form.append('audio', new Blob([new Uint8Array(26 * 1024 * 1024)], { type: 'audio/webm' }), 'big.webm');
  res = await fetch(`${app.url}/api/voice/clone`, { method: 'POST', body: form });
  assert.equal(res.status, 413);
});

test('voice delete and test-tts encode the voice id', async () => {
  const calls = mockFetch((call) => call.method === 'DELETE'
    ? jsonResponse({ status: 'ok' })
    : new Response(new Uint8Array([7]), { headers: { 'content-type': 'audio/mpeg' } }));

  let res = await fetch(`${app.url}/api/voice/clone/a%2Fb`, { method: 'DELETE' });
  assert.equal(res.status, 200);
  assert.equal(calls[0].url.pathname, '/v1/voices/a%2Fb');

  res = await fetch(`${app.url}/api/voice/test-tts/a%3Fb`);
  assert.equal(res.headers.get('content-type'), 'audio/mpeg');
  assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [7]);
  assert.equal(calls[1].url.pathname, '/v1/text-to-speech/a%3Fb');
});

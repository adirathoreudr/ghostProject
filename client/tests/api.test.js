import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { api, request } from '../src/lib/api.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function stubFetch(status, body) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  };
  return calls;
}

test('request returns parsed JSON on success', async () => {
  const calls = stubFetch(200, { status: 'ok' });
  assert.deepEqual(await api.health(), { status: 'ok' });
  assert.equal(calls[0].url, '/api/health');
});

test('request turns error responses into Errors carrying code and status', async () => {
  stubFetch(503, { error: 'ElevenLabs API key not configured', code: 'ELEVENLABS_NOT_CONFIGURED' });
  await assert.rejects(request('/voice/clone'), (err) => {
    assert.equal(err.message, 'ElevenLabs API key not configured');
    assert.equal(err.code, 'ELEVENLABS_NOT_CONFIGURED');
    assert.equal(err.status, 503);
    return true;
  });
});

test('request copes with non-JSON error bodies', async () => {
  stubFetch(502, '<html>Bad gateway</html>');
  await assert.rejects(request('/health'), /HTTP 502/);
});

test('voice ids are URL-encoded', async () => {
  assert.equal(api.voice.testTTS('a/b?c'), '/api/voice/test-tts/a%2Fb%3Fc');
  const calls = stubFetch(200, { success: true });
  await api.voice.deleteClone('a/b');
  assert.equal(calls[0].url, '/api/voice/clone/a%2Fb');
  assert.equal(calls[0].options.method, 'DELETE');
});

test('voice clone uploads the recording as multipart form data', async () => {
  const calls = stubFetch(200, { voice_id: 'v9' });
  const res = await api.voice.clone(new Blob([new Uint8Array(8)], { type: 'audio/webm' }), 'Ana');
  assert.equal(res.voice_id, 'v9');
  const body = calls[0].options.body;
  assert.equal(body.get('name'), 'Ana');
  assert.equal(body.get('audio').name, 'voice_sample.webm');
});

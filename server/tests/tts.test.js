import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mockFetch, restoreFetch, audioResponse, jsonResponse, fakeExpressResponse } from './helpers.js';

process.env.ELEVENLABS_API_KEY = 'test-key';
const { streamTTS } = await import('../src/lib/tts.js');

afterEach(restoreFetch);

test('streamTTS sends the Turbo v2.5 model and voice settings to ElevenLabs', async () => {
  const calls = mockFetch(() => audioResponse([1, 2, 3]));
  const res = fakeExpressResponse();

  await streamTTS('Hello there', 'voice123', res);

  assert.equal(calls.length, 1);
  assert.match(calls[0].url.pathname, /\/v1\/text-to-speech\/voice123\/stream$/);
  const body = JSON.parse(calls[0].body);
  assert.equal(body.text, 'Hello there');
  assert.equal(body.model_id, 'eleven_turbo_v2_5');
  assert.equal(body.voice_settings?.stability, 0.45);
  assert.equal(body.voice_settings?.similarity_boost, 0.88);
  assert.equal(calls[0].url.searchParams.get('output_format'), 'mp3_44100_128');
  assert.equal(res.headers['Content-Type'], 'audio/mpeg');
  assert.deepEqual([...Buffer.concat(res.chunks)], [1, 2, 3]);
  assert.equal(res.ended, true);
});

test('streamTTS leaves headers untouched when ElevenLabs rejects the request', async () => {
  mockFetch(() => jsonResponse({ detail: { message: 'voice not found' } }, 404));
  const res = fakeExpressResponse();

  await assert.rejects(streamTTS('Hi', 'missing', res));
  assert.equal(res.headers['Content-Type'], undefined);
  assert.equal(res.headers['Transfer-Encoding'], undefined);
});

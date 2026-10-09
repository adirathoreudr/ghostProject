import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startFakeRiva } from './fakes.js';
import { pcmToWav, parseWav } from '../src/lib/wav.js';

let riva;
let rivaLib;
before(async () => {
  riva = await startFakeRiva({ transcript: 'Send me an email and I will think about it' });
  process.env.NVIDIA_RIVA_ENDPOINT = riva.endpoint;
  process.env.NVIDIA_API_KEY = 'nvapi-test';
  rivaLib = await import('../src/lib/riva.js');
});
after(() => riva.close());

test('rivaTranscribe sends raw PCM with the WAV format and NVIDIA auth metadata', async () => {
  const pcm = Buffer.alloc(3200, 5);
  const text = await rivaLib.rivaTranscribe(pcmToWav(pcm, 16000));
  assert.equal(text, 'Send me an email and I will think about it');

  const { request, metadata } = riva.calls.find(c => c.method === 'Recognize');
  assert.equal(request.config.encoding, 'LINEAR_PCM');
  assert.equal(request.config.sample_rate_hertz, 16000);
  assert.equal(request.config.audio_channel_count, 1);
  assert.equal(request.config.language_code, 'en-US');
  assert.equal(request.config.enable_automatic_punctuation, true);
  assert.deepEqual(request.audio, pcm);
  assert.equal(metadata.authorization, 'Bearer nvapi-test');
  assert.equal(metadata['function-id'], '1598d209-5e27-4d3c-8079-4751568b1081');
});

test('rivaSynthesize requests the Magpie voice and wraps the PCM in a WAV header', async () => {
  const wav = await rivaLib.rivaSynthesize('Totally fair. What would make this a clear yes?');
  const parsed = parseWav(wav);
  assert.equal(parsed.sampleRate, 44100);
  assert.equal(parsed.pcm.length, 4410 * 2);

  const { request, metadata } = riva.calls.find(c => c.method === 'Synthesize');
  assert.equal(request.voice_name, 'Magpie-Multilingual.EN-US.Aria');
  assert.equal(request.encoding, 'LINEAR_PCM');
  assert.equal(request.sample_rate_hz, 44100);
  assert.equal(metadata['function-id'], '877104f7-e885-42b9-8de8-f6e4c6303969');
});

test('function ids and voice can be overridden from the environment', async () => {
  process.env.NVIDIA_TTS_FUNCTION_ID = 'custom-fn';
  process.env.NVIDIA_TTS_VOICE = 'Magpie-Multilingual.EN-US.Ray';
  await rivaLib.rivaSynthesize('Hi');
  const { request, metadata } = riva.calls.at(-1);
  assert.equal(request.voice_name, 'Magpie-Multilingual.EN-US.Ray');
  assert.equal(metadata['function-id'], 'custom-fn');
  delete process.env.NVIDIA_TTS_FUNCTION_ID;
  delete process.env.NVIDIA_TTS_VOICE;
});

test('rivaTranscribe rejects non-WAV input before calling NVIDIA', async () => {
  const before = riva.calls.length;
  await assert.rejects(rivaLib.rivaTranscribe(Buffer.from('not audio at all')), /Not a WAV/);
  assert.equal(riva.calls.length, before);
});

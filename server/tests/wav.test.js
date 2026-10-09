import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWav, pcmToWav } from '../src/lib/wav.js';
import { getVoiceProvider, voiceBackend } from '../src/lib/voiceProvider.js';

test('pcmToWav and parseWav round-trip', () => {
  const pcm = Buffer.from([1, 0, 2, 0, 3, 0, 4, 0]);
  const wav = pcmToWav(pcm, 16000);
  assert.equal(wav.length, 44 + pcm.length);
  const parsed = parseWav(wav);
  assert.equal(parsed.sampleRate, 16000);
  assert.equal(parsed.channels, 1);
  assert.deepEqual(parsed.pcm, pcm);
});

test('parseWav skips extra chunks and clamps streaming sizes', () => {
  const wav = pcmToWav(Buffer.alloc(8, 7), 24000);
  const list = Buffer.concat([Buffer.from('LIST'), Buffer.from([4, 0, 0, 0]), Buffer.from('INFO')]);
  const withList = Buffer.concat([wav.subarray(0, 36), list, wav.subarray(36)]);
  withList.writeUInt32LE(0xffffffff, 36 + list.length + 4);
  assert.equal(parseWav(withList).pcm.length, 8);
});

test('parseWav rejects non-WAV and non-16-bit audio', () => {
  assert.throws(() => parseWav(Buffer.from('\x1aE\xdf\xa3 webm data')), /Not a WAV/);
  const eightBit = pcmToWav(Buffer.alloc(4), 8000);
  eightBit.writeUInt16LE(8, 34);
  assert.throws(() => parseWav(eightBit), /16-bit PCM/);
});

test('voice provider defaults to ElevenLabs only when its key is set', () => {
  const saved = { ...process.env };
  delete process.env.VOICE_PROVIDER;
  delete process.env.ELEVENLABS_API_KEY;
  assert.equal(getVoiceProvider(), 'free');
  process.env.ELEVENLABS_API_KEY = 'xi';
  assert.equal(getVoiceProvider(), 'elevenlabs');
  process.env.VOICE_PROVIDER = 'FREE';
  assert.equal(getVoiceProvider(), 'free');
  process.env = saved;
});

test('voiceBackend routes on the voice_id prefix', () => {
  assert.equal(voiceBackend('local:abc'), 'local');
  assert.equal(voiceBackend('nvidia:Magpie-Multilingual.EN-US.Aria'), 'nvidia');
  assert.equal(voiceBackend('21m00Tcm4TlvDq8ikWAM'), 'elevenlabs');
  assert.equal(voiceBackend(undefined), 'elevenlabs');
});

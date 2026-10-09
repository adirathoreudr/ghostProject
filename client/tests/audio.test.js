import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeWav, audioExtension } from '../src/lib/audio.js';

test('encodeWav writes a 16-bit mono PCM WAV header', () => {
  const buf = encodeWav(new Float32Array([0, 0.5, -0.5, 1, -1, 2]), 16000);
  const view = new DataView(buf);
  const text = (o, n) => String.fromCharCode(...new Uint8Array(buf, o, n));
  assert.equal(text(0, 4), 'RIFF');
  assert.equal(text(8, 4), 'WAVE');
  assert.equal(view.getUint16(20, true), 1);      // PCM
  assert.equal(view.getUint16(22, true), 1);      // mono
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 12);     // 6 samples × 2 bytes
  assert.equal(buf.byteLength, 44 + 12);
});

test('encodeWav scales and clips samples', () => {
  const view = new DataView(encodeWav(new Float32Array([0, 0.5, -0.5, 1, -1, 2]), 8000));
  const samples = [0, 1, 2, 3, 4, 5].map(i => view.getInt16(44 + i * 2, true));
  assert.deepEqual(samples, [0, 16383, -16384, 32767, -32768, 32767]);
});

test('audioExtension maps MIME types (with codec parameters) to file extensions', () => {
  assert.equal(audioExtension('audio/wav'), 'wav');
  assert.equal(audioExtension('audio/webm;codecs=opus'), 'webm');
  assert.equal(audioExtension('audio/mp4;codecs=mp4a.40.2'), 'mp4');
  assert.equal(audioExtension(''), 'webm');
});

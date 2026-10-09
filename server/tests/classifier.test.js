import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseClassification, normalizePersona } from '../src/lib/classifier.js';

test('parses plain JSON', () => {
  const r = parseClassification('{"objection_type":"timing","confidence":0.7,"response":"Fair."}');
  assert.deepEqual(r, { objection_type: 'timing', confidence: 0.7, response: 'Fair.' });
});

test('strips markdown fences and surrounding prose', () => {
  const raw = 'Here you go:\n```json\n{"objection_type":"authority","confidence":0.8,"response":"Bring them in."}\n```\nHope that helps!';
  assert.equal(parseClassification(raw).objection_type, 'authority');
});

test('unknown objection types fall back to stall', () => {
  const r = parseClassification('{"objection_type":"weather","confidence":0.4,"response":"Ok."}');
  assert.equal(r.objection_type, 'stall');
});

test('confidence is always a number between 0 and 1', () => {
  const missing = parseClassification('{"objection_type":"price","response":"Ok."}');
  assert.equal(missing.confidence, 0.5);
  const percent = parseClassification('{"objection_type":"price","confidence":85,"response":"Ok."}');
  assert.equal(percent.confidence, 0.85);
  const text = parseClassification('{"objection_type":"price","confidence":"0.9","response":"Ok."}');
  assert.equal(text.confidence, 0.9);
  const negative = parseClassification('{"objection_type":"price","confidence":-3,"response":"Ok."}');
  assert.equal(negative.confidence, 0);
});

test('rejects invalid JSON and empty responses', () => {
  assert.throws(() => parseClassification('not json at all'), /invalid JSON/);
  assert.throws(() => parseClassification('{"objection_type":"price","confidence":0.9}'), /empty response/);
});

test('normalizePersona only lets known personas through', () => {
  assert.equal(normalizePersona('voss'), 'voss');
  assert.equal(normalizePersona('cardone'), 'cardone');
  assert.equal(normalizePersona('evil\r\nX-Injected: 1'), 'hormozi');
  assert.equal(normalizePersona(undefined), 'hormozi');
});

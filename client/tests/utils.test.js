import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeDecodeHeader, isTypingTarget } from '../src/lib/utils.js';

test('safeDecodeHeader decodes and tolerates bad input', () => {
  assert.equal(safeDecodeHeader(encodeURIComponent('It’s "too" expensive — 100%')), 'It’s "too" expensive — 100%');
  assert.equal(safeDecodeHeader('%E0%A4%A'), '%E0%A4%A');
  assert.equal(safeDecodeHeader(null), '');
});

test('isTypingTarget only matches text entry elements', () => {
  assert.equal(isTypingTarget({ tagName: 'INPUT' }), true);
  assert.equal(isTypingTarget({ tagName: 'TEXTAREA' }), true);
  assert.equal(isTypingTarget({ tagName: 'SELECT' }), true);
  assert.equal(isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isTypingTarget({ tagName: 'BUTTON' }), false);
  assert.equal(isTypingTarget({ tagName: 'BODY' }), false);
  assert.equal(isTypingTarget(null), false);
});

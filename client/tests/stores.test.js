import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// zustand's persist middleware expects browser storage.
const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
};

const { useProfileStore, PERSONAS_MAP } = await import('../src/stores/profileStore.js');
const { useGhostStore } = await import('../src/stores/ghostStore.js');

beforeEach(() => {
  useProfileStore.getState().clearAll();
  useGhostStore.getState().clearSession();
});

test('first profile becomes active and defaults to the hormozi persona', () => {
  const p = useProfileStore.getState().addProfile({ name: 'Ana', voice_id: 'v1' });
  const state = useProfileStore.getState();
  assert.equal(state.activeProfileId, p.id);
  assert.equal(p.persona, 'hormozi');
  assert.ok(PERSONAS_MAP[p.persona]);
  assert.equal(state.getActiveProfile().name, 'Ana');
});

test('at most three profiles are allowed', () => {
  const { addProfile } = useProfileStore.getState();
  addProfile({ name: 'A', voice_id: '1' });
  addProfile({ name: 'B', voice_id: '2' });
  addProfile({ name: 'C', voice_id: '3' });
  assert.equal(useProfileStore.getState().canAddProfile(), false);
  assert.throws(() => addProfile({ name: 'D', voice_id: '4' }), /Maximum 3 profiles/);
});

test('removing the active profile activates the next one', () => {
  const { addProfile, removeProfile } = useProfileStore.getState();
  const a = addProfile({ name: 'A', voice_id: '1' });
  const b = addProfile({ name: 'B', voice_id: '2' });
  removeProfile(a.id);
  assert.equal(useProfileStore.getState().activeProfileId, b.id);
  removeProfile(b.id);
  assert.equal(useProfileStore.getState().activeProfileId, null);
});

test('profiles are persisted without the removed Speech Engine id', () => {
  useProfileStore.getState().addProfile({ name: 'A', voice_id: '1' });
  const saved = JSON.parse(localStorage.getItem('ghost-profiles'));
  assert.equal(saved.state.profiles.length, 1);
  assert.equal('engineId' in saved.state, false);
});

test('a call session logs each handled objection', () => {
  const g = useGhostStore.getState();
  g.startSession();
  const conversationId = useGhostStore.getState().conversationId;
  assert.match(conversationId, /^[0-9a-f-]{36}$/);

  g.setListening();
  assert.equal(useGhostStore.getState().status, 'listening');
  g.setProcessing();
  g.setSpeaking({ transcript: 'Too pricey', objectionType: 'price', confidence: 0.9, responseText: 'Math.', latencyMs: 1200 });

  const s = useGhostStore.getState();
  assert.equal(s.status, 'speaking');
  assert.equal(s.captionFinal, 'Too pricey');
  assert.equal(s.sessionLog.length, 1);
  assert.equal(s.sessionLog[0].objectionType, 'price');
  assert.equal(s.conversationId, conversationId);

  g.setListening();
  assert.equal(useGhostStore.getState().transcript, null);
  assert.equal(useGhostStore.getState().sessionLog.length, 1);

  g.setError('boom');
  assert.equal(useGhostStore.getState().errorMsg, 'boom');
  g.clearSession();
  assert.equal(useGhostStore.getState().sessionLog.length, 0);
  assert.equal(useGhostStore.getState().conversationId, null);
});

test('the removed prewarm cache is gone from the store', () => {
  const s = useGhostStore.getState();
  assert.equal('prewarmCache' in s, false);
  assert.equal('setPrewarmCache' in s, false);
});

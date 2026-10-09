import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { parseBullets, buildFallbackSummary } from '../src/routes/debrief.js';
import { mockFetch, restoreFetch, jsonResponse, startApp } from './helpers.js';

const LOG = [
  { objectionType: 'stall', transcript: 'Let me think', responseText: 'Sure', latencyMs: 1000, confidence: 0.8 },
  { objectionType: 'price', transcript: 'Too pricey', responseText: 'Math', latencyMs: 2000, confidence: 0.9 },
  { objectionType: 'price', transcript: 'No budget', responseText: 'ROI', latencyMs: 3000, confidence: 0.7 },
];

test('parseBullets handles •, dash and numbered bullets', () => {
  assert.deepEqual(
    parseBullets('Summary:\n• First point\n2. Second point\n3) Third point\n4. Fourth is dropped'),
    ['First point', 'Second point', 'Third point'],
  );
  assert.deepEqual(parseBullets('- **Overall:** solid\n* Next time ask earlier'), ['Overall: solid', 'Next time ask earlier']);
});

test('fallback summary picks the most frequent type without reordering the log', () => {
  const log = structuredClone(LOG);
  const summary = buildFallbackSummary(log);
  assert.match(summary[0], /3 objections across types: stall, price/);
  assert.match(summary[1], /"price"/);
  assert.match(summary[2], /2000ms/);
  assert.deepEqual(log, LOG);
});

test('fallback summary survives missing latency values', () => {
  const summary = buildFallbackSummary([{ objectionType: 'timing' }]);
  assert.match(summary[2], /0ms/);
});

let app;
before(async () => { app = await startApp(); });
after(() => app.close());
afterEach(() => { restoreFetch(); delete process.env.NVIDIA_API_KEY; });

async function postSummary(body) {
  const res = await fetch(`${app.url}/api/debrief/summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

test('POST /api/debrief/summary uses the template when no NVIDIA key is set', async () => {
  const { status, data } = await postSummary({ sessionLog: LOG, repName: 'Ana' });
  assert.equal(status, 200);
  assert.equal(data.source, 'fallback');
  assert.equal(data.summary.length, 3);
});

test('POST /api/debrief/summary returns cleaned LLM bullets', async () => {
  process.env.NVIDIA_API_KEY = 'nvapi-test';
  mockFetch(() => jsonResponse({ choices: [{ message: { content: '1. Strong on price\n2. Stall needed a label\n3. Ask for the close sooner' } }] }));
  const { data } = await postSummary({ sessionLog: LOG, repName: 'Ana' });
  assert.equal(data.source, 'llm');
  assert.deepEqual(data.summary, ['Strong on price', 'Stall needed a label', 'Ask for the close sooner']);
});

test('POST /api/debrief/summary falls back when the LLM fails', async () => {
  process.env.NVIDIA_API_KEY = 'nvapi-test';
  mockFetch(() => jsonResponse({ detail: 'down' }, 503));
  const { data } = await postSummary({ sessionLog: LOG });
  assert.equal(data.source, 'fallback');
});

test('POST /api/debrief/summary validates input', async () => {
  assert.equal((await postSummary({ sessionLog: 'nope' })).status, 400);
  const empty = await postSummary({ sessionLog: [] });
  assert.equal(empty.status, 200);
  assert.equal(empty.data.summary[0], 'No objections were handled this session.');
});

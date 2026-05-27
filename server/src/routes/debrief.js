import { Router } from 'express';
import fetch from 'node-fetch';
import { captureEvent } from '../lib/posthog.js';

export const debriefRouter = Router();

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MODEL = 'meta/llama-3.3-70b-instruct';

/**
 * POST /api/debrief/summary
 * Generates a 3-bullet call summary from the session log.
 * Falls back to deterministic template if NVIDIA call fails.
 */
debriefRouter.post('/summary', async (req, res) => {
  const { sessionLog = [], repName = 'Rep', conversationId, persona } = req.body;

  if (!sessionLog.length) {
    return res.json({ summary: ['No objections were handled this session.', '', ''] });
  }

  // ── PostHog: log call ended ───────────────────────────────────
  captureEvent(repName, 'call_ended', {
    conversation_id: conversationId,
    persona,
    objections_handled: sessionLog.length,
    objection_types: sessionLog.map(e => e.objectionType),
    avg_latency_ms: Math.round(sessionLog.reduce((s, e) => s + e.latencyMs, 0) / sessionLog.length),
  });

  // ── Log each objection to PostHog ─────────────────────────────
  sessionLog.forEach((entry, idx) => {
    captureEvent(repName, 'objection_handled', {
      conversation_id: conversationId,
      rep_id: repName,
      objection_type: entry.objectionType,
      persona,
      transcript: entry.transcript,
      response_text: entry.responseText,
      latency_ms: entry.latencyMs,
      confidence: entry.confidence,
      used_ghost: entry.usedGhost !== false,
      sequence: idx + 1,
    });
  });

  // ── Try NVIDIA summary ────────────────────────────────────────
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return res.json({ summary: buildFallbackSummary(sessionLog), source: 'fallback' });
  }

  const objLog = sessionLog.map((e, i) =>
    `${i + 1}. [${e.objectionType?.toUpperCase()}] Prospect: "${e.transcript}" → Ghost: "${e.responseText}" (${e.latencyMs}ms)`
  ).join('\n');

  const prompt = `You are a sales coach reviewing a call debrief. The rep used an AI co-pilot called Ghost to handle objections.

Session data:
Rep: ${repName}
Persona used: ${persona || 'hormozi'}
Objections handled: ${sessionLog.length}

Objection log:
${objLog}

Write exactly 3 bullet points (start each with "•") summarizing:
1. How the objections were handled overall
2. The most important objection and how it was addressed
3. One concrete recommendation for the rep's next call

Be concise, direct, and sales-specific. No fluff. Each bullet max 25 words.`;

  try {
    const llmRes = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!llmRes.ok) throw new Error(`NVIDIA ${llmRes.status}`);

    const data = await llmRes.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';
    const bullets = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('•') || l.match(/^\d\./))
      .map(l => l.replace(/^[•\d.]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 3);

    if (bullets.length < 2) throw new Error('Not enough bullets in response');

    console.log('[Debrief] ✅ LLM summary generated');
    return res.json({ summary: bullets, source: 'llm' });

  } catch (err) {
    console.warn('[Debrief] LLM summary failed, using fallback:', err.message);
    return res.json({ summary: buildFallbackSummary(sessionLog), source: 'fallback' });
  }
});

function buildFallbackSummary(sessionLog) {
  const types = [...new Set(sessionLog.map(e => e.objectionType))];
  const avgMs = Math.round(sessionLog.reduce((s, e) => s + e.latencyMs, 0) / sessionLog.length);
  const topType = sessionLog.sort((a, b) =>
    sessionLog.filter(x => x.objectionType === b.objectionType).length -
    sessionLog.filter(x => x.objectionType === a.objectionType).length
  )[0]?.objectionType || 'stall';

  return [
    `Ghost handled ${sessionLog.length} objection${sessionLog.length !== 1 ? 's' : ''} across types: ${types.join(', ')}.`,
    `Most frequent objection type was "${topType}" — review Ghost's response framing for this pattern.`,
    `Average response latency was ${avgMs}ms. Practice holding SPACE earlier to capture full objections.`,
  ];
}

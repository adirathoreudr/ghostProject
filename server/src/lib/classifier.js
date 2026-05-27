import fetch from 'node-fetch';

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MODEL = 'meta/llama-3.3-70b-instruct';

const PERSONA_PROMPTS = {
  hormozi: `You are channeling Alex Hormozi's sales philosophy. Your response style:
- Lead with undeniable value and ROI. Make the math obvious.
- Be direct, confident, and never defensive. Objections are just confusion about value.
- Reframe every objection as a value gap you can close immediately.
- Use contrast: "What would it cost you NOT to solve this?"
- Short punchy sentences. No fluff. High conviction energy.
- Never beg. State facts. Let the value speak.
Example tone: "Here's what that actually costs you. Every month you don't solve this, you're losing X. The question isn't whether you can afford this — it's whether you can afford not to."`,

  voss: `You are channeling Chris Voss's FBI negotiation methodology. Your response style:
- Lead with a label that names their emotion: "It sounds like..." or "It seems like..."
- Use calibrated questions that make them think: "What is it about X that concerns you?"
- Mirror key words back to them (repeat the last 1-3 words as a question).
- Aim for "That's right" — not "yes." Validate before advancing.
- Stay calm, never pushy. Let silence work. Tactical empathy over pressure.
- Never argue. Acknowledge fully, then gently redirect.
Example tone: "It sounds like you're not sure this is the right time. What would need to be true for the timing to feel right?"`,

  cardone: `You are channeling Grant Cardone's 10X sales methodology. Your response style:
- Never accept the first no. The first no means they need more information.
- High energy, high conviction. Enthusiasm is contagious.
- Use repetition and follow-up pressure: "I hear you — and here's what I know for certain..."
- Reframe hesitation as a decision they're making to stay stuck.
- Always ask for the close again after handling the objection.
- Bold, direct, zero apology for selling.
Example tone: "Look, I've heard that before. And every single client who said that and still moved forward told me six months later it was the best decision they made. Are you in or are you out?"`,
};

const CLASSIFIER_SYSTEM = `You are an elite sales objection classifier and response generator for Ghost, a real-time sales co-pilot.

Your job: analyze the prospect's statement and return a structured JSON response ONLY. No preamble. No markdown. No explanation outside the JSON.

OBJECTION TYPES (pick exactly one):
- stall: "I need to think about it", "let me get back to you", "not right now", "I'm busy"
- price: "too expensive", "out of budget", "can't afford it", "price is high", "cheaper options"
- authority: "need to check with my partner/boss/wife/team", "can't decide alone", "need approval"
- timing: "not the right time", "maybe next quarter", "we're in a busy period"
- competitor: "we're looking at other options", "your competitor is cheaper", "already using X"

RESPONSE RULES:
- The response must be immediately speakable as natural conversational audio — no bullet points, no lists.
- 2-4 sentences max. Punchy. No hedging.
- Write in first person as if the sales rep is speaking.
- Do NOT mention Ghost, AI, or any tool.
- Match the persona style injected below exactly.

Return ONLY valid JSON — no markdown fences, no explanation, nothing outside the JSON object:
{"objection_type":"stall|price|authority|timing|competitor","confidence":0.0,"response":"spoken response text here"}`;

export async function classifyObjection(transcript, persona = 'hormozi') {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('NVIDIA_API_KEY not set in .env');

  const personaPrompt = PERSONA_PROMPTS[persona] || PERSONA_PROMPTS.hormozi;

  console.log(`[Classifier] Classifying: "${transcript.slice(0, 80)}" | Persona: ${persona}`);
  const startMs = Date.now();

  const res = await fetch(NVIDIA_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `${CLASSIFIER_SYSTEM}\n\nACTIVE PERSONA:\n${personaPrompt}`,
        },
        {
          role: 'user',
          content: `Prospect said: "${transcript}"\n\nClassify and respond. Return JSON only.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`NVIDIA API error ${res.status}: ${err.detail || err.message || JSON.stringify(err)}`);
  }

  const data = await res.json();
  const latencyMs = Date.now() - startMs;
  const raw = data.choices?.[0]?.message?.content?.trim() || '';

  console.log(`[Classifier] Raw response (${latencyMs}ms): ${raw}`);

  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error('[Classifier] JSON parse failed:', cleaned);
    throw new Error(`Model returned invalid JSON: ${cleaned.slice(0, 100)}`);
  }

  const validTypes = ['stall', 'price', 'authority', 'timing', 'competitor'];
  if (!validTypes.includes(parsed.objection_type)) {
    console.warn('[Classifier] Unknown type:', parsed.objection_type, '— defaulting to stall');
    parsed.objection_type = 'stall';
  }
  if (!parsed.response || typeof parsed.response !== 'string') {
    throw new Error('Model returned empty response text');
  }

  console.log(`[Classifier] ✅ Type: ${parsed.objection_type} (${(parsed.confidence * 100).toFixed(0)}%) | "${parsed.response.slice(0, 60)}..."`);

  return { ...parsed, latency_ms: latencyMs };
}

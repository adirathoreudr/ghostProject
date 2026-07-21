/*

/**
 * Ghost session state machine
 * States: idle | listening | processing | speaking | error
 */

export const useGhostStore = create((set, get) => ({
  // ── Core state ─────────────────────────────────────────────────
  status: 'idle',
  transcript: null,
  objectionType: null,
  confidence: null,
  responseText: null,
  errorMsg: null,
  latencyMs: null,

  // ── Live captions ──────────────────────────────────────────────
  // Tokens accumulate during listening; cleared on new takeover
  captionTokens: [],       // [{ text, isObjection, ts }]
  captionFinal: null,      // finalized caption string after STT

  // ── Session data ───────────────────────────────────────────────
  sessionLog: [],          // objections handled this call
  conversationId: null,    // unique per call session
  callStartTime: null,

  // ── Pre-warm cache ─────────────────────────────────────────────
  prewarmCache: {},        // { objection_type: audioBlob }
  prewarmStatus: 'idle',   // idle | loading | ready | failed

  // ── Actions ───────────────────────────────────────────────────
  startSession: () => set({
    conversationId: crypto.randomUUID(),
    callStartTime: Date.now(),
    sessionLog: [],
    captionTokens: [],
    captionFinal: null,
    status: 'idle',
    errorMsg: null,
  }),

  setListening: () => set({
    status: 'listening',
    transcript: null,
    objectionType: null,
    confidence: null,
    responseText: null,
    errorMsg: null,
    captionTokens: [],
    captionFinal: null,
  }),

  setProcessing: () => set({ status: 'processing' }),

  // Add a caption token during streaming transcription simulation
  addCaptionToken: (text, isObjection = false) => set(state => ({
    captionTokens: [...state.captionTokens, { text, isObjection, ts: Date.now() }],
  })),

  setCaptionFinal: (text) => set({ captionFinal: text }),

  setSpeaking: ({ transcript, objectionType, confidence, responseText, latencyMs }) => {
    const state = useGhostStore.getState();
    const entry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      transcript,
      objectionType,
      confidence,
      responseText,
      latencyMs,
      usedGhost: true,
    };
    set(state => ({
      status: 'speaking',
      transcript,
      objectionType,
      confidence,
      responseText,
      latencyMs,
      captionFinal: transcript,
      sessionLog: [...state.sessionLog, entry],
    }));
  },

  setIdle: () => set({ status: 'idle' }),

  setError: (msg) => set({ status: 'error', errorMsg: msg }),

  clearSession: () => set({
    status: 'idle',
    transcript: null,
    objectionType: null,
    confidence: null,
    responseText: null,
    errorMsg: null,
    latencyMs: null,
    captionTokens: [],
    captionFinal: null,
    sessionLog: [],
    conversationId: null,
    callStartTime: null,
  }),

  setPrewarmStatus: (s) => set({ prewarmStatus: s }),
  setPrewarmCache: (cache) => set({ prewarmCache: cache, prewarmStatus: 'ready' }),
}));

// Objection type display config
export const OBJECTION_META = {
  stall:      { label: 'Stall',      color: '#f4a623', desc: 'Delay tactic' },
  price:      { label: 'Price',      color: '#e94560', desc: 'Cost objection' },
  authority:  { label: 'Authority',  color: '#00d4ff', desc: 'Decision maker absent' },
  timing:     { label: 'Timing',     color: '#a855f7', desc: 'Not the right time' },
  competitor: { label: 'Competitor', color: '#00ff88', desc: 'Comparing alternatives' },
};

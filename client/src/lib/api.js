const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.code = data.code;
    err.status = res.status;
    err.details = data.details;
    throw err;
  }
  return data;
}

export const api = {
  health: () => request('/health'),

  engine: {
    create: () => request('/engine/create', { method: 'POST' }),
    status: () => request('/engine/status'),
  },

  voice: {
    clone: async (audioBlob, name) => {
      const form = new FormData();
      form.append('audio', audioBlob, 'voice_sample.webm');
      form.append('name', name);
      return request('/voice/clone', { method: 'POST', body: form });
    },
    testTTS: (voiceId) => `/api/voice/test-tts/${voiceId}`,
    deleteClone: (voiceId) => request(`/voice/clone/${voiceId}`, { method: 'DELETE' }),
  },

  ghost: {
    prewarm: (voice_id, persona) =>
      request('/ghost/prewarm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_id, persona }),
      }),

    classifyOnly: async (audioBlob, voice_id, persona) => {
      const form = new FormData();
      form.append('audio', audioBlob, 'test.webm');
      form.append('voice_id', voice_id);
      form.append('persona', persona);
      form.append('mime_type', audioBlob.type);
      return request('/ghost/classify-only', { method: 'POST', body: form });
    },
  },
};

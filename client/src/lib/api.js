const BASE = '/api';

export async function request(path, options = {}) {
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

  voice: {
    clone: async (audioBlob, name) => {
      const form = new FormData();
      form.append('audio', audioBlob, 'voice_sample.webm');
      form.append('name', name);
      return request('/voice/clone', { method: 'POST', body: form });
    },
    testTTS: (voiceId) => `/api/voice/test-tts/${encodeURIComponent(voiceId)}`,
    deleteClone: (voiceId) => request(`/voice/clone/${encodeURIComponent(voiceId)}`, { method: 'DELETE' }),
  },
};

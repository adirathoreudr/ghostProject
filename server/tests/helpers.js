const realFetch = globalThis.fetch;

/**
 * Replace global fetch for outbound API calls. Requests to localhost (the app
 * under test) still go to the real fetch. The ElevenLabs SDK resolves the
 * global fetch at call time, so SDK traffic is intercepted too.
 *
 * `handler(call)` returns a Response; `call` is { url, method, headers, body }.
 * Returns the array that every intercepted call is pushed onto.
 */
export function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      return realFetch(input, init);
    }
    const call = { url, method: init.method || 'GET', headers: new Headers(init.headers), body: init.body };
    calls.push(call);
    return handler(call);
  };
  return calls;
}

export function restoreFetch() {
  globalThis.fetch = realFetch;
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

export function audioResponse(bytes = [0xff, 0xfb, 0x90, 0x00]) {
  return new Response(new Uint8Array(bytes), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
}

/** Minimal stand-in for an Express response, enough for streamTTS. */
export function fakeExpressResponse() {
  const res = {
    headers: {},
    chunks: [],
    ended: false,
    set(h) { Object.assign(this.headers, h); return this; },
    write(c) { this.chunks.push(Buffer.from(c)); return true; },
    end() { this.ended = true; },
  };
  return res;
}

/** Start the Express app on an ephemeral port. Returns { url, close }. */
export async function startApp() {
  const { createApp } = await import('../src/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise(resolve => server.close(resolve)),
  };
}

/** Build the multipart body the client sends to /api/ghost/takeover. */
export function takeoverForm(fields = {}, audio = new Uint8Array(2048).fill(1)) {
  const form = new FormData();
  if (audio) form.append('audio', new Blob([audio], { type: 'audio/webm' }), 'objection.webm');
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return form;
}

/** Route mocked upstream calls: ElevenLabs STT/TTS and the NVIDIA LLM. */
export function upstream({ transcript = 'The price is too high for us', llm, tts } = {}) {
  return (call) => {
    const { hostname, pathname } = call.url;
    if (hostname === 'api.elevenlabs.io' && pathname.endsWith('/speech-to-text')) {
      return jsonResponse({ language_code: 'en', language_probability: 0.99, text: transcript, words: [] });
    }
    if (hostname === 'api.elevenlabs.io' && pathname.includes('/text-to-speech/')) {
      return tts ? tts(call) : audioResponse([9, 9, 9]);
    }
    if (hostname === 'integrate.api.nvidia.com') {
      const content = llm ?? '{"objection_type":"price","confidence":0.92,"response":"What would it cost you not to fix this?"}';
      return jsonResponse({ choices: [{ message: { content } }] });
    }
    return new Response('unexpected upstream call', { status: 599 });
  };
}

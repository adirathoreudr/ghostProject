import http from 'node:http';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'node:url';
import { pcmToWav } from '../src/lib/wav.js';

/** A real gRPC server implementing Riva Recognize + Synthesize from the vendored protos. */
export async function startFakeRiva({ transcript = 'We are already using another vendor', ttsSamples = 4410 } = {}) {
  const definition = protoLoader.loadSync(
    ['riva/proto/riva_asr.proto', 'riva/proto/riva_tts.proto'],
    { includeDirs: [fileURLToPath(new URL('../proto', import.meta.url))], keepCase: true, longs: Number, enums: String, defaults: true },
  );
  const riva = grpc.loadPackageDefinition(definition).nvidia.riva;
  const calls = [];
  const record = (method, call) => calls.push({ method, request: call.request, metadata: call.metadata.getMap() });

  const server = new grpc.Server();
  server.addService(riva.asr.RivaSpeechRecognition.service, {
    Recognize(call, cb) {
      record('Recognize', call);
      cb(null, { results: [{ alternatives: [{ transcript, confidence: 0.93 }] }] });
    },
  });
  server.addService(riva.tts.RivaSpeechSynthesis.service, {
    Synthesize(call, cb) {
      record('Synthesize', call);
      cb(null, { audio: Buffer.alloc(ttsSamples * 2, 1) });
    },
  });
  const port = await new Promise((resolve, reject) =>
    server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (e, p) => (e ? reject(e) : resolve(p))));
  return { endpoint: `127.0.0.1:${port}`, calls, close: () => new Promise(r => server.tryShutdown(r)) };
}

/** An HTTP stand-in for voice-server/server.py. */
export async function startFakeVoiceServer() {
  const voices = new Set();
  const calls = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const send = (status, data, type = 'application/json') => {
      res.writeHead(status, { 'content-type': type });
      res.end(type === 'application/json' ? JSON.stringify(data) : data);
    };
    calls.push({ method: req.method, url: req.url, headers: req.headers, body });

    if (req.method === 'GET' && req.url === '/health') return send(200, { status: 'ok', model: 'fake' });
    if (req.method === 'POST' && req.url === '/voices') {
      const form = await new Request('http://x/', { method: 'POST', headers: req.headers, body }).formData();
      const id = 'a'.repeat(31) + voices.size;
      voices.add(id);
      calls.at(-1).form = form;
      return send(200, { voice_id: id, name: form.get('name') });
    }
    const del = req.url.match(/^\/voices\/(.+)$/);
    if (req.method === 'DELETE' && del) {
      return voices.delete(del[1]) ? send(200, { deleted: del[1] }) : send(404, { detail: 'Unknown voice' });
    }
    if (req.method === 'POST' && req.url === '/tts') {
      const { voice_id } = JSON.parse(body);
      if (!voices.has(voice_id)) return send(404, { detail: 'Unknown voice' });
      return send(200, pcmToWav(Buffer.alloc(480, 2), 24000), 'audio/wav');
    }
    send(404, { detail: 'Not found' });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    voices,
    calls,
    close: () => new Promise(r => server.close(r)),
  };
}

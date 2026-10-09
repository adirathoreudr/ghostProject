import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'node:url';
import { parseWav, pcmToWav } from './wav.js';

// NVIDIA Riva over gRPC. By default this talks to the free hosted endpoints on
// build.nvidia.com with the same NVIDIA_API_KEY used by the classifier. Every
// value can be overridden, e.g. if NVIDIA rotates a function id or you run a
// Riva / Speech NIM container yourself (NVIDIA_RIVA_ENDPOINT=localhost:50051).
const DEFAULTS = {
  endpoint: 'grpc.nvcf.nvidia.com:443',
  asrFunctionId: '1598d209-5e27-4d3c-8079-4751568b1081', // nvidia/parakeet-ctc-1.1b-asr
  ttsFunctionId: '877104f7-e885-42b9-8de8-f6e4c6303969', // nvidia/magpie-tts-multilingual
  ttsVoice: 'Magpie-Multilingual.EN-US.Aria',
};
const TTS_SAMPLE_RATE = 44100;
const PROTO_ROOT = fileURLToPath(new URL('../../proto', import.meta.url));

let _clients = null;

function getClients() {
  const endpoint = process.env.NVIDIA_RIVA_ENDPOINT || DEFAULTS.endpoint;
  if (_clients?.endpoint === endpoint) return _clients;

  const definition = protoLoader.loadSync(
    ['riva/proto/riva_asr.proto', 'riva/proto/riva_tts.proto'],
    { includeDirs: [PROTO_ROOT], keepCase: true, longs: Number, enums: String, defaults: true },
  );
  const riva = grpc.loadPackageDefinition(definition).nvidia.riva;
  // Local endpoints (self-hosted containers, tests) normally run without TLS.
  const insecure = process.env.NVIDIA_RIVA_INSECURE === '1' || /^(localhost|127\.0\.0\.1|\[::1\]):/.test(endpoint);
  const credentials = insecure ? grpc.credentials.createInsecure() : grpc.credentials.createSsl();

  _clients?.asr.close();
  _clients?.tts.close();
  _clients = {
    endpoint,
    asr: new riva.asr.RivaSpeechRecognition(endpoint, credentials),
    tts: new riva.tts.RivaSpeechSynthesis(endpoint, credentials),
  };
  return _clients;
}

function metadata(functionId) {
  const md = new grpc.Metadata();
  if (functionId) md.set('function-id', functionId);
  if (process.env.NVIDIA_API_KEY) md.set('authorization', `Bearer ${process.env.NVIDIA_API_KEY}`);
  return md;
}

function call(client, method, request, functionId, timeoutMs) {
  return new Promise((resolve, reject) => {
    client[method](request, metadata(functionId), { deadline: Date.now() + timeoutMs }, (err, response) => {
      if (err) reject(new Error(`NVIDIA Riva ${method} failed: ${err.details || err.message}`));
      else resolve(response);
    });
  });
}

/**
 * Transcribe a 16-bit PCM WAV recording with NVIDIA Parakeet ASR.
 * @param {Buffer} wavBuffer
 * @returns {Promise<string>}
 */
export async function rivaTranscribe(wavBuffer) {
  const { sampleRate, channels, pcm } = parseWav(wavBuffer);
  const response = await call(getClients().asr, 'Recognize', {
    config: {
      encoding: 'LINEAR_PCM',
      sample_rate_hertz: sampleRate,
      audio_channel_count: channels,
      language_code: 'en-US',
      max_alternatives: 1,
      enable_automatic_punctuation: true,
    },
    audio: pcm,
  }, process.env.NVIDIA_ASR_FUNCTION_ID ?? DEFAULTS.asrFunctionId, 20000);

  return response.results
    .map(r => r.alternatives[0]?.transcript || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Synthesize speech with NVIDIA Magpie TTS (a stock voice — no cloning).
 * @param {string} text
 * @param {string} [voiceName] - e.g. "Magpie-Multilingual.EN-US.Aria"
 * @returns {Promise<Buffer>} WAV audio
 */
export async function rivaSynthesize(text, voiceName) {
  const response = await call(getClients().tts, 'Synthesize', {
    text,
    language_code: 'en-US',
    encoding: 'LINEAR_PCM',
    sample_rate_hz: TTS_SAMPLE_RATE,
    voice_name: voiceName || process.env.NVIDIA_TTS_VOICE || DEFAULTS.ttsVoice,
  }, process.env.NVIDIA_TTS_FUNCTION_ID ?? DEFAULTS.ttsFunctionId, 30000);

  return pcmToWav(response.audio, TTS_SAMPLE_RATE);
}

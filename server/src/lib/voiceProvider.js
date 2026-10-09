// Which voice stack Ghost uses:
//   elevenlabs — ElevenLabs STT, voice cloning and TTS (paid, credit based)
//   free       — NVIDIA Riva STT (same key as the classifier) + your voice
//                cloned locally by the Chatterbox voice server (voice-server/)
export const LOCAL_PREFIX = 'local:';
export const NVIDIA_PREFIX = 'nvidia:';

export function getVoiceProvider() {
  const explicit = process.env.VOICE_PROVIDER?.trim().toLowerCase();
  if (explicit === 'free' || explicit === 'elevenlabs') return explicit;
  return process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'free';
}

/**
 * Where a profile's voice lives, from its voice_id prefix:
 *   "local:<id>"     → local Chatterbox clone
 *   "nvidia:<voice>" → NVIDIA Magpie stock voice
 *   anything else    → ElevenLabs voice clone
 */
export function voiceBackend(voiceId = '') {
  if (voiceId.startsWith(LOCAL_PREFIX)) return 'local';
  if (voiceId.startsWith(NVIDIA_PREFIX)) return 'nvidia';
  return 'elevenlabs';
}

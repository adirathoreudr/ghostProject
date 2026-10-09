import { getVoiceProvider } from './voiceProvider.js';

const OPTIONAL = [
  'POSTHOG_API_KEY',
];

export function validateEnv() {
  // Free mode only needs the NVIDIA key (classifier + Riva speech).
  const required = getVoiceProvider() === 'elevenlabs'
    ? ['ELEVENLABS_API_KEY', 'NVIDIA_API_KEY']
    : ['NVIDIA_API_KEY'];

  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.warn(`\n⚠️  Ghost: Missing required env vars: ${missing.join(', ')}`);
    console.warn('   Copy .env.example → .env (repo root) and fill in values.\n');
  }
  const missingOpt = OPTIONAL.filter(k => !process.env[k]);
  if (missingOpt.length > 0) {
    console.warn(`⚠️  Ghost: Missing optional env vars: ${missingOpt.join(', ')}`);
  }
}

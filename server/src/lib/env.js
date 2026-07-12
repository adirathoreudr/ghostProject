/**
 * Environment variable validation module.
 * Checks for required and optional variables at startup.
 */
const REQUIRED = [
  'ELEVENLABS_API_KEY',
  'NVIDIA_API_KEY',
];

const OPTIONAL = [
  'POSTHOG_API_KEY',
/**
 * Validates that required environment variables are set.
 * Logs warnings for missing required and optional variables.
 * @returns {void}
 */
  'NGROK_URL',
];

export function validateEnv() {
  const missing = REQUIRED.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.warn(`\n⚠️  Ghost: Missing required env vars: ${missing.join(', ')}`);
    console.warn('   Copy .env.example → .env and fill in values.\n');
  }
  const missingOpt = OPTIONAL.filter(k => !process.env[k]);
  if (missingOpt.length > 0) {
    console.warn(`⚠️  Ghost: Missing optional env vars: ${missingOpt.join(', ')}`);
  }
}

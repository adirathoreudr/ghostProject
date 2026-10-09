import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { validateEnv } from './lib/env.js';
import { shutdownPostHog } from './lib/posthog.js';

// .env lives at the repo root (see README); server/.env still works as a fallback.
loadEnv({
  path: [
    fileURLToPath(new URL('../../.env', import.meta.url)),
    fileURLToPath(new URL('../.env', import.meta.url)),
  ],
});

validateEnv();

const PORT = process.env.PORT || 3001;
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`\n🎙️  Ghost Server running on http://localhost:${PORT}`);
  console.log(`🔑 ElevenLabs: ${process.env.ELEVENLABS_API_KEY ? '✅ configured' : '❌ MISSING'}`);
  console.log(`🤖 NVIDIA LLM: ${process.env.NVIDIA_API_KEY     ? '✅ configured' : '❌ MISSING'}`);
  console.log(`📊 PostHog:    ${process.env.POSTHOG_API_KEY    ? '✅ configured' : '❌ MISSING'}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    server.close();
    await shutdownPostHog().catch(() => {});
    process.exit(0);
  });
}

export default app;

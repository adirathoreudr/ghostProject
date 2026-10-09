import { Router } from 'express';
import { getVoiceProvider } from '../lib/voiceProvider.js';
import { localVoiceHealth } from '../lib/localVoice.js';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  const provider = getVoiceProvider();
  const env = { voice_provider: provider };
  if (provider === 'elevenlabs') {
    env.elevenlabs = !!process.env.ELEVENLABS_API_KEY;
  } else {
    env.voice_server = !!(await localVoiceHealth());
  }
  env.nvidia = !!process.env.NVIDIA_API_KEY;
  env.posthog = !!process.env.POSTHOG_API_KEY;

  res.json({
    status: 'ok',
    service: 'ghost-server',
    timestamp: new Date().toISOString(),
    env,
  });
});

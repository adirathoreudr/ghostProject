import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ghost-server',
    timestamp: new Date().toISOString(),
    env: {
      elevenlabs: !!process.env.ELEVENLABS_API_KEY,
      nvidia: !!process.env.NVIDIA_API_KEY,
      posthog: !!process.env.POSTHOG_API_KEY,
      ngrok: process.env.NGROK_URL || null,
    },
  });
});

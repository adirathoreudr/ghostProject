import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { voiceRouter } from './routes/voice.js';
import { engineRouter } from './routes/engine.js';
import { healthRouter } from './routes/health.js';
import { ghostRouter } from './routes/ghost.js';
import { debriefRouter } from './routes/debrief.js';
import { validateEnv } from './lib/env.js';

validateEnv();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:4173'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/health',  healthRouter);
app.use('/api/voice',   voiceRouter);
app.use('/api/engine',  engineRouter);
app.use('/api/ghost',   ghostRouter);
app.use('/api/debrief', debriefRouter);

app.use((err, req, res, next) => {
  console.error('[Ghost Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'UNKNOWN_ERROR',
  });
});

app.listen(PORT, () => {
  console.log(`\n🎙️  Ghost Server running on http://localhost:${PORT}`);
  console.log(`📡 Ngrok URL: ${process.env.NGROK_URL || 'NOT SET'}`);
  console.log(`🔑 ElevenLabs: ${process.env.ELEVENLABS_API_KEY ? '✅ configured' : '❌ MISSING'}`);
  console.log(`🤖 NVIDIA LLM: ${process.env.NVIDIA_API_KEY     ? '✅ configured' : '❌ MISSING'}`);
  console.log(`📊 PostHog:    ${process.env.POSTHOG_API_KEY    ? '✅ configured' : '❌ MISSING'}\n`);
});

export default app;

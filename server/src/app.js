import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { voiceRouter } from './routes/voice.js';
import { healthRouter } from './routes/health.js';
import { ghostRouter } from './routes/ghost.js';
import { debriefRouter } from './routes/debrief.js';

export function createApp() {
  const app = express(); // Initialize Express application

  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    credentials: true,
  }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Parse URL-encoded bodies

  app.use('/api/health',  healthRouter);
  app.use('/api/voice',   voiceRouter);
  app.use('/api/ghost',   ghostRouter);
  app.use('/api/debrief', debriefRouter);

  app.use((err, req, res, next) => {
    // Upload problems (file too large, unexpected field) are client errors, not 500s.
    if (err instanceof multer.MulterError) {
      return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
        error: err.message,
        code: err.code,
      });
    }
    console.error('[Ghost Server Error]', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      code: err.code || 'UNKNOWN_ERROR',
    });
  });

  return app;
}

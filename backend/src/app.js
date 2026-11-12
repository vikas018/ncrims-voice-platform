import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import { notFound, errorHandler } from './middleware/error.middleware.js';

import authRoutes from './routes/auth.routes.js';
import campaignRoutes from './routes/campaign.routes.js';
import callRoutes from './routes/call.routes.js';
import walletRoutes from './routes/wallet.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import orgRoutes from './routes/org.routes.js';
// Isolated test feature — Claude-driven Hindi voice chat (not part of Vapi).
import claudeVoiceRoutes from './routes/claudeVoice.routes.js';

const app = express();

// CORS: allow configured origins, localhost (any port), and ANY *.vercel.app
// deployment (so preview URLs never 403). CORS_ORIGIN=* allows everything.
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // same-origin / curl / server-to-server
      if (config.corsOrigin.includes('*')) return cb(null, true);
      if (config.corsOrigin.includes(origin)) return cb(null, true);
      try {
        const host = new URL(origin).hostname;
        if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app')) return cb(null, true);
      } catch { /* malformed origin */ }
      return cb(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Root route — many hosts health-check "/"; return 200 so deploys pass.
app.get('/', (req, res) => res.json({ service: 'ncrims-backend', status: 'ok' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', env: config.env, provider: config.voice.provider }));

app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/org', orgRoutes);
app.use('/api/claude-voice', claudeVoiceRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;

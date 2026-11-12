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

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
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

app.use(notFound);
app.use(errorHandler);

export default app;

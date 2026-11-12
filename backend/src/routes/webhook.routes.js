import { Router } from 'express';
import { handleVoiceWebhook } from '../controllers/webhook.controller.js';

// NOTE: no requireAuth here — providers authenticate via signature
// (verifySignature in each adapter), not our JWT.
const router = Router();

router.post('/voice/:provider', handleVoiceWebhook);

export default router;

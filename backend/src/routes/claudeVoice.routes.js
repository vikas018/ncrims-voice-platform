/**
 * Routes for the isolated Claude Voice test feature.
 * Mounted at /api/claude-voice in app.js. No auth — the controller gates on
 * ENABLE_CLAUDE_VOICE and rate-limits per IP.
 */
import { Router } from 'express';
import { chat } from '../controllers/claudeVoice.controller.js';

const router = Router();

router.post('/chat', chat);

export default router;

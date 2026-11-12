import { Router } from 'express';
import { summary } from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.get('/summary', requireAuth, summary);

export default router;

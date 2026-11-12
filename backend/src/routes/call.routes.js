import { Router } from 'express';
import { listCalls, getCall, testCall } from '../controllers/call.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', listCalls);
router.post('/test', testCall);
router.get('/:id', getCall);

export default router;

import { Router } from 'express';
import { listCalls, exportCalls, getCall, testCall } from '../controllers/call.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', listCalls);
router.get('/export', exportCalls); // must precede "/:id" so "export" isn't treated as an id
router.post('/test', testCall);
router.get('/:id', getCall);

export default router;

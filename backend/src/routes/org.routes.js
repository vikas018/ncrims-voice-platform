import { Router } from 'express';
import { getOrg, updateOrg } from '../controllers/org.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', getOrg);
router.patch('/', requireAdmin, updateOrg);

export default router;

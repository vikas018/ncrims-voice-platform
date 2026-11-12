import { Router } from 'express';
import { balance, addPackage, transactions } from '../controllers/wallet.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', balance);
router.get('/transactions', transactions);
router.post('/topup', requireAdmin, addPackage);

export default router;

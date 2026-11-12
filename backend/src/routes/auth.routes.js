import { Router } from 'express';
import { login, me, changePassword, createUser, listUsers, updateUser, deleteUser } from '../controllers/auth.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/login', login);
router.get('/me', requireAuth, me);
router.post('/change-password', requireAuth, changePassword);
router.get('/users', requireAuth, listUsers);
router.post('/users', requireAuth, requireAdmin, createUser);
router.patch('/users/:id', requireAuth, requireAdmin, updateUser);
router.delete('/users/:id', requireAuth, requireAdmin, deleteUser);

export default router;

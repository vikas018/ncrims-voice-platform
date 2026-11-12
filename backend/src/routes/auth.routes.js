import { Router } from 'express';
import multer from 'multer';
import { login, me, changePassword, createUser, bulkCreateUsers, listUsers, updateUser, deleteUser } from '../controllers/auth.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const router = Router();

router.post('/login', login);
router.get('/me', requireAuth, me);
router.post('/change-password', requireAuth, changePassword);
router.get('/users', requireAuth, listUsers);
router.post('/users', requireAuth, requireAdmin, createUser);
router.post('/users/bulk', requireAuth, requireAdmin, upload.single('file'), bulkCreateUsers);
router.patch('/users/:id', requireAuth, requireAdmin, updateUser);
router.delete('/users/:id', requireAuth, requireAdmin, deleteUser);

export default router;

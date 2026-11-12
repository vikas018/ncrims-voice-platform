import { Router } from 'express';
import multer from 'multer';
import {
  createCampaign,
  listCampaigns,
  getCampaign,
  previewUpload,
  commitUpload,
  triggerCampaign,
  setCampaignStatus,
  deleteCampaign,
} from '../controllers/campaign.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

// Keep uploads in memory — we parse then discard; raw files never hit disk/DB.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();
router.use(requireAuth);

router.get('/', listCampaigns);
router.post('/', createCampaign);
router.get('/:id', getCampaign);
router.post('/:id/preview', upload.single('file'), previewUpload);
router.post('/:id/upload', upload.single('file'), commitUpload);
router.post('/:id/trigger', triggerCampaign);
router.patch('/:id/status', setCampaignStatus);
router.delete('/:id', deleteCampaign);

export default router;

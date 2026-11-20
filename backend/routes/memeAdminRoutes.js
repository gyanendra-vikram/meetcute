import express from 'express';
import {
  approveMeme,
  getPendingMemes,
  rejectMeme,
  runMemeIngestionNow,
} from '../controllers/memeAssetController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireMemeAdmin } from '../middleware/memeAdminMiddleware.js';

const router = express.Router();

router.use(protect, requireMemeAdmin);
router.get('/', getPendingMemes);
router.post('/ingest', runMemeIngestionNow);
router.post('/:memeId/approve', approveMeme);
router.post('/:memeId/reject', rejectMeme);

export default router;

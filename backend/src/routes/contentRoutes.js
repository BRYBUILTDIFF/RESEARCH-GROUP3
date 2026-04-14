import { Router } from 'express';
import {
  createContent,
  deleteContent,
  listContent,
  updateContent,
} from '../controllers/contentController.js';
import { requireRole } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', listContent);
router.post('/', requireRole('admin'), createContent);
router.put('/:id', requireRole('admin'), updateContent);
router.delete('/:id', requireRole('admin'), deleteContent);

export default router;

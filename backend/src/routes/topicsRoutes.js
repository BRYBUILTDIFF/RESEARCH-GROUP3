import { Router } from 'express';
import {
  createTopic,
  deleteTopic,
  listTopics,
  reorderTopics,
  updateTopic,
} from '../controllers/topicsController.js';
import { requireRole } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', listTopics);
router.patch('/reorder', requireRole('admin'), reorderTopics);
router.post('/', requireRole('admin'), createTopic);
router.put('/:id', requireRole('admin'), updateTopic);
router.delete('/:id', requireRole('admin'), deleteTopic);

export default router;

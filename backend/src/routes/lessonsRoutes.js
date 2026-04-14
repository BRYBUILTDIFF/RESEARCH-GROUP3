import { Router } from 'express';
import {
  createLesson,
  deleteLesson,
  getLessonById,
  listLessons,
  reorderLessons,
  updateLesson,
} from '../controllers/lessonsController.js';
import { requireRole } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', listLessons);
router.get('/:id', getLessonById);
router.patch('/reorder', requireRole('admin'), reorderLessons);
router.post('/', requireRole('admin'), createLesson);
router.put('/:id', requireRole('admin'), updateLesson);
router.delete('/:id', requireRole('admin'), deleteLesson);

export default router;

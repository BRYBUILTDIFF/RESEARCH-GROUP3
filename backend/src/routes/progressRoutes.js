import { Router } from 'express';
import {
  completeLesson,
  getEnrollmentProgress,
  saveLessonPosition,
} from '../controllers/progressController.js';

const router = Router();

router.get('/:enrollmentId', getEnrollmentProgress);
router.post('/lessons/:lessonId/complete', completeLesson);
router.post('/lessons/:lessonId/checkpoint', saveLessonPosition);

export default router;

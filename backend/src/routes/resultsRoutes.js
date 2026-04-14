import { Router } from 'express';
import {
  getEnrollmentResults,
  listResults,
  submitQuiz,
} from '../controllers/resultsController.js';

const router = Router();

router.get('/', listResults);
router.get('/enrollments/:enrollmentId', getEnrollmentResults);
router.post('/submit', submitQuiz);

export default router;

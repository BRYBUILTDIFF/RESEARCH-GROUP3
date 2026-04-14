import { Router } from 'express';
import {
  createQuestionAnswer,
  createQuiz,
  createQuizQuestion,
  deleteQuestionAnswer,
  deleteQuizQuestion,
  deleteQuiz,
  listQuestionAnswers,
  listQuizQuestions,
  listQuizzes,
  startQuiz,
  updateQuestionAnswer,
  updateQuizQuestion,
  updateQuiz,
} from '../controllers/quizzesController.js';
import { requireRole } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', listQuizzes);
router.post('/', requireRole('admin'), createQuiz);
router.get('/:id/questions', requireRole('admin'), listQuizQuestions);
router.post('/:id/questions', requireRole('admin'), createQuizQuestion);
router.put('/questions/:questionId', requireRole('admin'), updateQuizQuestion);
router.delete('/questions/:questionId', requireRole('admin'), deleteQuizQuestion);
router.get('/questions/:questionId/answers', requireRole('admin'), listQuestionAnswers);
router.post('/questions/:questionId/answers', requireRole('admin'), createQuestionAnswer);
router.put('/answers/:answerId', requireRole('admin'), updateQuestionAnswer);
router.delete('/answers/:answerId', requireRole('admin'), deleteQuestionAnswer);
router.put('/:id', requireRole('admin'), updateQuiz);
router.delete('/:id', requireRole('admin'), deleteQuiz);
router.post('/:id/start', startQuiz);

export default router;

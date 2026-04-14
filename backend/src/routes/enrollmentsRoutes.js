import { Router } from 'express';
import {
  createEnrollment,
  getEnrollmentById,
  listEnrollments,
} from '../controllers/enrollmentsController.js';

const router = Router();

router.get('/', listEnrollments);
router.post('/', createEnrollment);
router.get('/:id', getEnrollmentById);

export default router;

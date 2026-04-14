import { Router } from 'express';
import { adminDashboard, userDashboard } from '../controllers/dashboardController.js';
import { requireRole } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/admin', requireRole('admin'), adminDashboard);
router.get('/user', requireRole('user'), userDashboard);

export default router;

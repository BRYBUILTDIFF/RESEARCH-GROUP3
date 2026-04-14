import { Router } from 'express';
import {
  createNotification,
  listNotifications,
  markNotificationRead,
} from '../controllers/notificationsController.js';
import { requireRole } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', listNotifications);
router.post('/', requireRole('admin'), createNotification);
router.patch('/:id/read', markNotificationRead);

export default router;

import { Router } from 'express';
import {
  createUser,
  deleteUser,
  getMyProfile,
  getUserById,
  getUserLogs,
  listUsers,
  updateMyProfile,
  updateUser,
} from '../controllers/usersController.js';
import { requireRole } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/me', getMyProfile);
router.patch('/me', updateMyProfile);

router.get('/', requireRole('admin'), listUsers);
router.post('/', requireRole('admin'), createUser);
router.get('/:id', requireRole('admin'), getUserById);
router.put('/:id', requireRole('admin'), updateUser);
router.delete('/:id', requireRole('admin'), deleteUser);
router.get('/:id/logs', requireRole('admin'), getUserLogs);

export default router;

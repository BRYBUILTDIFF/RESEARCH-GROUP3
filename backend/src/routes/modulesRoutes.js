import { Router } from 'express';
import {
  createModule,
  deleteModule,
  getModuleBuilder,
  getModuleById,
  listModules,
  setModuleLock,
  updateModule,
} from '../controllers/modulesController.js';
import { requireRole } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', listModules);
router.get('/:id', getModuleById);
router.get('/:id/builder', requireRole('admin'), getModuleBuilder);
router.post('/', requireRole('admin'), createModule);
router.put('/:id', requireRole('admin'), updateModule);
router.delete('/:id', requireRole('admin'), deleteModule);
router.patch('/:id/lock', requireRole('admin'), setModuleLock);

export default router;

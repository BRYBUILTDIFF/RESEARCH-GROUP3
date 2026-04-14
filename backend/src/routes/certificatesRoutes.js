import { Router } from 'express';
import {
  downloadCertificate,
  getCertificateById,
  listCertificates,
} from '../controllers/certificatesController.js';

const router = Router();

router.get('/', listCertificates);
router.get('/:id', getCertificateById);
router.get('/:id/download', downloadCertificate);

export default router;

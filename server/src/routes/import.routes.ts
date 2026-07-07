import { Router } from 'express';
import { handleImport } from '../controllers/import.controller';
import { uploadMiddleware } from '../middleware/upload';

const router = Router();

router.post('/', uploadMiddleware.single('file'), handleImport);

export default router;

import express, { RequestHandler } from 'express';
import * as photoController from '../controllers/photo';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate as RequestHandler);

// Get shared photos
router.get('/', photoController.getSharedPhotos as RequestHandler);

// Share/unshare photos
router.post('/:id', photoController.sharePhoto as RequestHandler);
router.delete('/:id', photoController.unsharePhoto as RequestHandler);

export default router; 
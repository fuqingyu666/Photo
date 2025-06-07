import express, { RequestHandler } from 'express';
import * as photoController from '../controllers/photo';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate as RequestHandler);

// Get photos
router.get('/', photoController.getUserPhotos as RequestHandler);
router.get('/shared', photoController.getSharedPhotos as RequestHandler);
router.get('/:id', photoController.getPhotoById as RequestHandler);

// Manage photos
router.post('/', photoController.createPhoto as RequestHandler);
router.put('/:id', photoController.updatePhoto as RequestHandler);
router.delete('/:id', photoController.deletePhoto as RequestHandler);

// Share photos
router.post('/:id/share', photoController.sharePhoto as RequestHandler);
router.delete('/:id/share', photoController.unsharePhoto as RequestHandler);

export default router; 
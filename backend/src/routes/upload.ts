import express, { RequestHandler } from 'express';
import * as uploadController from '../controllers/upload';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate as RequestHandler);

// Initialize upload
router.post('/init', uploadController.initUpload as RequestHandler);

// Upload chunk with multer middleware
router.post('/chunk', uploadController.uploadMiddleware as RequestHandler, uploadController.uploadChunk as RequestHandler);

// Complete upload
router.post('/complete', uploadController.completeUpload as RequestHandler);

// Get upload status
router.get('/:id', uploadController.getUploadStatus as RequestHandler);

// Update upload status (pause/resume)
router.put('/:id/status', uploadController.updateUploadStatus as RequestHandler);

// Delete upload
router.delete('/:id', uploadController.deleteUpload as RequestHandler);

// Get user uploads
router.get('/', uploadController.getUserUploads as RequestHandler);

export default router; 
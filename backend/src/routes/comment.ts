import express, { RequestHandler } from 'express';
import * as commentController from '../controllers/comment';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate as RequestHandler);

// Get comments for a photo
router.get('/photo/:photoId', commentController.getComments as RequestHandler);

// Create a new comment
router.post('/photo/:photoId', commentController.createComment as RequestHandler);

// Delete a comment
router.delete('/photo/:photoId/comment/:commentId', commentController.deleteComment as RequestHandler);

export default router; 
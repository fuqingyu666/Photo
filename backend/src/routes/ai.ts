import express, { RequestHandler } from 'express';
import * as aiController from '../controllers/ai';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate as RequestHandler);

// Photo analysis
router.post('/analyze/:id', aiController.analyzePhoto as RequestHandler);
router.get('/analysis/:id', aiController.getPhotoAnalysis as RequestHandler);
router.get('/tags/:id', aiController.generateTags as RequestHandler);

// AI chat
router.post('/chat', aiController.chat as RequestHandler);
router.get('/chat/history', aiController.getChatHistory as RequestHandler);

export default router; 
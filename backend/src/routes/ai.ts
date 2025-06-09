import express, { RequestHandler } from 'express';
import * as aiController from '../controllers/ai';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// 所有路由都需要认证
router.use(authenticate as RequestHandler);

// 照片分析
router.post('/analyze/:id', aiController.analyzePhoto as RequestHandler);
router.get('/analysis/:id', aiController.getPhotoAnalysis as RequestHandler);
router.get('/tags/:id', aiController.generateTags as RequestHandler);

// AI聊天
router.post('/chat', aiController.chat as RequestHandler);
router.get('/chat/history', aiController.getChatHistory as RequestHandler);

export default router; 
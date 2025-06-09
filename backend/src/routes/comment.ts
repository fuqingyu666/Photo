import express, { RequestHandler } from 'express';
import * as commentController from '../controllers/comment';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// 所有路由都需要认证
router.use(authenticate as RequestHandler);

// 获取照片的评论
router.get('/photo/:photoId', commentController.getComments as RequestHandler);

// 创建新评论
router.post('/photo/:photoId', commentController.createComment as RequestHandler);

// 删除评论
router.delete('/photo/:photoId/comment/:commentId', commentController.deleteComment as RequestHandler);

export default router; 
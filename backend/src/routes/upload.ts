import express, { RequestHandler } from 'express';
import * as uploadController from '../controllers/upload';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// 所有路由都需要身份验证
router.use(authenticate as RequestHandler);

// 初始化上传
router.post('/init', uploadController.uploadMiddleware as RequestHandler, uploadController.initUpload as RequestHandler);

// 使用 multer 中间件上传分块
router.post('/chunk', uploadController.uploadMiddleware as RequestHandler, uploadController.uploadChunk as RequestHandler);
router.post('/chunk/:id', uploadController.uploadMiddleware as RequestHandler, uploadController.uploadChunk as RequestHandler);

// 完成上传
router.post('/complete', uploadController.completeUpload as RequestHandler);

// 获取上传状态
router.get('/:id', uploadController.getUploadStatus as RequestHandler);

// 更新上传状态（暂停/恢复）
router.put('/:id/status', uploadController.updateUploadStatus as RequestHandler);

// 删除上传
router.delete('/:id', uploadController.deleteUpload as RequestHandler);

// 获取用户上传列表
router.get('/', uploadController.getUserUploads as RequestHandler);

export default router; 
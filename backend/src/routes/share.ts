import express, { RequestHandler } from 'express';
import * as photoController from '../controllers/photo';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// 所有路由都需要认证
router.use(authenticate as RequestHandler);

// 获取共享照片
router.get('/', photoController.getSharedPhotos as RequestHandler);

// 共享/取消共享照片
router.post('/:id', photoController.sharePhoto as RequestHandler);
router.delete('/:id', photoController.unsharePhoto as RequestHandler);

export default router; 
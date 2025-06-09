import express, { RequestHandler } from 'express';
import * as photoController from '../controllers/photo';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// 所有路由都需要认证
router.use(authenticate as RequestHandler);

// 获取照片
router.get('/', photoController.getUserPhotos as RequestHandler);
router.get('/shared', photoController.getSharedPhotos as RequestHandler);
router.get('/:id', photoController.getPhotoById as RequestHandler);

// 管理照片
router.post('/', photoController.createPhoto as RequestHandler);
router.put('/:id', photoController.updatePhoto as RequestHandler);
router.delete('/:id', photoController.deletePhoto as RequestHandler);

// 共享照片
router.post('/:id/share', photoController.sharePhoto as RequestHandler);
router.delete('/:id/share', photoController.unsharePhoto as RequestHandler);

export default router; 
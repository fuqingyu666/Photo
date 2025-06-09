import express, { RequestHandler } from 'express';
import * as authController from '../controllers/auth';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// 公开路由
router.post('/register', authController.register as RequestHandler);
router.post('/login', authController.login as RequestHandler);

// 受保护路由
router.get('/profile', authenticate as RequestHandler, authController.getProfile as RequestHandler);
router.put('/profile', authenticate as RequestHandler, authController.updateProfile as RequestHandler);
router.post('/change-password', authenticate as RequestHandler, authController.changePassword as RequestHandler);

export default router; 
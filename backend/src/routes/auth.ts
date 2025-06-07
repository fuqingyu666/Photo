import express, { RequestHandler } from 'express';
import * as authController from '../controllers/auth';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/register', authController.register as RequestHandler);
router.post('/login', authController.login as RequestHandler);

// Protected routes
router.get('/profile', authenticate as RequestHandler, authController.getProfile as RequestHandler);
router.put('/profile', authenticate as RequestHandler, authController.updateProfile as RequestHandler);
router.post('/change-password', authenticate as RequestHandler, authController.changePassword as RequestHandler);

export default router; 
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import pool from '../config/database';

// 扩展 Express Request 接口以包含用户属性
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                username: string;
                email: string;
            };
        }
    }
}

/**
 * 验证JWT令牌的认证中间件
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // 从头部获取令牌
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // 验证令牌
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, String(env.JWT_SECRET)) as { id: string };

        // 检查用户是否存在于数据库中
        const [rows] = await pool.execute(
            'SELECT id, username, email FROM users WHERE id = ?',
            [decoded.id]
        );

        const users = rows as { id: string; username: string; email: string }[];
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // 将用户添加到请求对象
        req.user = users[0];
        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        next(error);
    }
};

/**
 * 可选认证中间件，不要求认证
 * 但如果令牌有效，会验证并附加用户信息
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // 从头部获取令牌
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        // 验证令牌
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, String(env.JWT_SECRET)) as { id: string };

        // 检查用户是否存在于数据库中
        const [rows] = await pool.execute(
            'SELECT id, username, email FROM users WHERE id = ?',
            [decoded.id]
        );

        const users = rows as { id: string; username: string; email: string }[];
        if (users.length > 0) {
            req.user = users[0];
        }

        next();
    } catch (error) {
        // 对可选认证不返回错误
        next();
    }
}; 
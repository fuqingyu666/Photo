import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import pool from '../config/database';

// Extend Express Request interface to include user property
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
 * Authentication middleware to verify JWT token
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // Verify token
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, String(env.JWT_SECRET)) as { id: string };

        // Check if user exists in database
        const [rows] = await pool.execute(
            'SELECT id, username, email FROM users WHERE id = ?',
            [decoded.id]
        );

        const users = rows as { id: string; username: string; email: string }[];
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Add user to request object
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
 * Optional authentication middleware that doesn't require authentication
 * but will still verify and attach user if token is valid
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        // Verify token
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, String(env.JWT_SECRET)) as { id: string };

        // Check if user exists in database
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
        // Do not return error for optional auth
        next();
    }
}; 
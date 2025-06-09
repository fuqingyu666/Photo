import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel, UserRegistration, UserLogin, User } from '../models/user';
import env from '../config/env';

/**
 * 注册新用户
 */
export const register = async (req: Request, res: Response) => {
    try {
        console.log('Register request body:', req.body);
        const userData: UserRegistration = req.body;

        // 验证必填字段
        if (!userData.username || !userData.email || !userData.password) {
            console.log('Missing required fields:', {
                username: !!userData.username,
                email: !!userData.email,
                password: !!userData.password
            });
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userData.email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // 验证密码长度
        if (userData.password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        // 创建用户
        const user = await UserModel.create(userData);

        // 生成JWT令牌
        const token = generateToken(user);

        // 返回用户数据和令牌
        res.status(201).json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            },
            token
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'Email already in use') {
            return res.status(409).json({ error: error.message });
        }

        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
};

/**
 * 用户登录
 */
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password }: UserLogin = req.body;

        // 验证必填字段
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // 通过邮箱查找用户
        const user = await UserModel.findByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 验证密码
        const isPasswordValid = await UserModel.verifyPassword(user, password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 生成JWT令牌
        const token = generateToken(user);

        // 返回用户数据和令牌
        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatar: user.avatar
            },
            token
        });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
};

/**
 * 获取当前用户资料
 */
export const getProfile = async (req: Request, res: Response) => {
    try {
        // 用户已通过auth中间件附加到请求
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // 从数据库获取用户以确保我们有最新数据
        const user = await UserModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('Error getting profile:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
};

/**
 * 更新用户资料
 */
export const updateProfile = async (req: Request, res: Response) => {
    try {
        // 用户已通过auth中间件附加到请求
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { username, avatar } = req.body;

        // 更新用户
        const updatedUser = await UserModel.update(req.user.id, { username, avatar });
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                avatar: updatedUser.avatar,
                created_at: updatedUser.created_at
            }
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

/**
 * 修改密码
 */
export const changePassword = async (req: Request, res: Response) => {
    try {
        // 用户已通过auth中间件附加到请求
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { currentPassword, newPassword } = req.body;

        // 验证必填字段
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        // 验证新密码长度
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }

        // 获取带有密码的用户
        const user = await UserModel.findByEmail(req.user.email);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 验证当前密码
        const isPasswordValid = await UserModel.verifyPassword(user, currentPassword);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // 修改密码
        await UserModel.changePassword(req.user.id, newPassword);

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
};

/**
 * 生成JWT令牌
 */
const generateToken = (user: User): string => {
    try {
        return jwt.sign(
            { id: user.id },
            String(env.JWT_SECRET)
        ) as string;
    } catch (error) {
        console.error('Error generating token:', error);
        throw new Error('Failed to generate authentication token');
    }
}; 
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel, UserRegistration, UserLogin, User } from '../models/user';
import env from '../config/env';

/**
 * Register a new user
 */
export const register = async (req: Request, res: Response) => {
    try {
        console.log('Register request body:', req.body);
        const userData: UserRegistration = req.body;

        // Validate required fields
        if (!userData.username || !userData.email || !userData.password) {
            console.log('Missing required fields:', {
                username: !!userData.username,
                email: !!userData.email,
                password: !!userData.password
            });
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userData.email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Validate password length
        if (userData.password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        // Create user
        const user = await UserModel.create(userData);

        // Generate JWT token
        const token = generateToken(user);

        // Return user data and token
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
 * Login user
 */
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password }: UserLogin = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user by email
        const user = await UserModel.findByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isPasswordValid = await UserModel.verifyPassword(user, password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = generateToken(user);

        // Return user data and token
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
 * Get current user profile
 */
export const getProfile = async (req: Request, res: Response) => {
    try {
        // User is already attached to request by auth middleware
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Get user from database to ensure we have latest data
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
 * Update user profile
 */
export const updateProfile = async (req: Request, res: Response) => {
    try {
        // User is already attached to request by auth middleware
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { username, avatar } = req.body;

        // Update user
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
 * Change password
 */
export const changePassword = async (req: Request, res: Response) => {
    try {
        // User is already attached to request by auth middleware
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { currentPassword, newPassword } = req.body;

        // Validate required fields
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        // Validate new password length
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }

        // Get user with password
        const user = await UserModel.findByEmail(req.user.email);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isPasswordValid = await UserModel.verifyPassword(user, currentPassword);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Change password
        await UserModel.changePassword(req.user.id, newPassword);

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
};

/**
 * Generate JWT token
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
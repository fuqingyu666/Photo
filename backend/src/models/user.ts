import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import pool from '../config/database';

export interface User {
    id: string;
    username: string;
    email: string;
    password?: string;
    avatar?: string;
    created_at?: Date;
    updated_at?: Date;
}

export interface UserRegistration {
    username: string;
    email: string;
    password: string;
}

export interface UserLogin {
    email: string;
    password: string;
}

export class UserModel {
    /**
     * Create a new user
     */
    static async create(userData: UserRegistration): Promise<User> {
        const { username, email, password } = userData;

        // Check if email already exists
        const [existingUsers] = await pool.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if ((existingUsers as any[]).length > 0) {
            throw new Error('Email already in use');
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Generate UUID
        const id = uuidv4();

        // Create user in database
        await pool.execute(
            'INSERT INTO users (id, username, email, password) VALUES (?, ?, ?, ?)',
            [id, username, email, hashedPassword]
        );

        // Return user without password
        return {
            id,
            username,
            email
        };
    }

    /**
     * Find user by email
     */
    static async findByEmail(email: string): Promise<User | null> {
        const [rows] = await pool.execute(
            'SELECT id, username, email, password, avatar, created_at, updated_at FROM users WHERE email = ?',
            [email]
        );

        const users = rows as User[];
        return users.length > 0 ? users[0] : null;
    }

    /**
     * Find user by ID
     */
    static async findById(id: string): Promise<User | null> {
        const [rows] = await pool.execute(
            'SELECT id, username, email, avatar, created_at, updated_at FROM users WHERE id = ?',
            [id]
        );

        const users = rows as User[];
        return users.length > 0 ? users[0] : null;
    }

    /**
     * Update user
     */
    static async update(id: string, userData: Partial<User>): Promise<User | null> {
        // Remove sensitive fields
        const { password, ...updateData } = userData;

        // Build update query
        const entries = Object.entries(updateData).filter(([_, value]) => value !== undefined);
        if (entries.length === 0) {
            return this.findById(id);
        }

        const fields = entries.map(([key, _]) => `${key} = ?`).join(', ');
        const values = entries.map(([_, value]) => value);

        // Update user
        await pool.execute(
            `UPDATE users SET ${fields} WHERE id = ?`,
            [...values, id]
        );

        // Return updated user
        return this.findById(id);
    }

    /**
     * Verify user password
     */
    static async verifyPassword(user: User, password: string): Promise<boolean> {
        if (!user.password) {
            return false;
        }

        return bcrypt.compare(password, user.password);
    }

    /**
     * Change user password
     */
    static async changePassword(id: string, newPassword: string): Promise<boolean> {
        // Hash new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await pool.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, id]
        );

        return true;
    }
} 
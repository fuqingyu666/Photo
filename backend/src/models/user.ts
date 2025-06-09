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
     * 创建新用户
     */
    static async create(userData: UserRegistration): Promise<User> {
        const { username, email, password } = userData;

        // 检查邮箱是否已存在
        const [existingUsers] = await pool.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if ((existingUsers as any[]).length > 0) {
            throw new Error('Email already in use');
        }

        // 密码加密
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 生成UUID
        const id = uuidv4();

        // 在数据库中创建用户
        await pool.execute(
            'INSERT INTO users (id, username, email, password) VALUES (?, ?, ?, ?)',
            [id, username, email, hashedPassword]
        );

        // 返回用户信息（不包含密码）
        return {
            id,
            username,
            email
        };
    }

    /**
     * 通过邮箱查找用户
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
     * 通过ID查找用户
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
     * 更新用户信息
     */
    static async update(id: string, userData: Partial<User>): Promise<User | null> {
        // 移除敏感字段
        const { password, ...updateData } = userData;

        // 构建更新查询
        const entries = Object.entries(updateData).filter(([_, value]) => value !== undefined);
        if (entries.length === 0) {
            return this.findById(id);
        }

        const fields = entries.map(([key, _]) => `${key} = ?`).join(', ');
        const values = entries.map(([_, value]) => value);

        // 更新用户
        await pool.execute(
            `UPDATE users SET ${fields} WHERE id = ?`,
            [...values, id]
        );

        // 返回更新后的用户
        return this.findById(id);
    }

    /**
     * 验证用户密码
     */
    static async verifyPassword(user: User, password: string): Promise<boolean> {
        if (!user.password) {
            return false;
        }

        return bcrypt.compare(password, user.password);
    }

    /**
     * 修改用户密码
     */
    static async changePassword(id: string, newPassword: string): Promise<boolean> {
        // 对新密码进行哈希处理
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // 更新密码
        await pool.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, id]
        );

        return true;
    }
} 
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import pool from '../config/database';

async function createTestUser() {
    try {
        console.log('Creating test user...');

        // 检查测试用户是否已存在
        const [existingUsers] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            ['test@example.com']
        );

        if ((existingUsers as any[]).length > 0) {
            console.log('Test user already exists');
            return;
        }

        // 创建新用户
        const userId = uuidv4();
        const hashedPassword = await bcrypt.hash('password123', 10);

        await pool.execute(
            'INSERT INTO users (id, username, email, password) VALUES (?, ?, ?, ?)',
            [userId, 'testuser', 'test@example.com', hashedPassword]
        );

        console.log('Test user created successfully');
        console.log('Email: test@example.com');
        console.log('Password: password123');
        console.log('User ID:', userId);

        return userId;
    } catch (error) {
        console.error('Error creating test user:', error);
        throw error;
    }
}

// 直接执行此脚本时运行
if (require.main === module) {
    createTestUser()
        .then(() => {
            console.log('Done');
            process.exit(0);
        })
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

export default createTestUser; 
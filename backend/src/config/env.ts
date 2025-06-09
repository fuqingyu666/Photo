import dotenv from 'dotenv';
import path from 'path';

// 从.env文件加载环境变量
dotenv.config({ path: path.join(__dirname, '../../.env') });

export default {
    // 服务器配置
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '5000', 10),

    // 数据库配置
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_USER: process.env.DB_USER || 'root',
    DB_PASSWORD: process.env.DB_PASSWORD || 'password',
    DB_NAME: process.env.DB_NAME || 'photo_app',
    DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),

    // JWT配置
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',

    // 文件上传配置
    UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
    CHUNK_SIZE: parseInt(process.env.CHUNK_SIZE || '2097152', 10), // 2MB大小（字节）

    // CORS配置
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3001',

    // DeepSeek AI配置
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
    DEEPSEEK_API_URL: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com'
}; 
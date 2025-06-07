import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

export default {
    // Server configuration
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '5000', 10),

    // Database configuration
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_USER: process.env.DB_USER || 'root',
    DB_PASSWORD: process.env.DB_PASSWORD || 'password',
    DB_NAME: process.env.DB_NAME || 'photo_app',
    DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),

    // JWT configuration
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',

    // File upload configuration
    UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
    CHUNK_SIZE: parseInt(process.env.CHUNK_SIZE || '2097152', 10), // 2MB in bytes

    // CORS configuration
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3001',

    // DeepSeek AI configuration
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
    DEEPSEEK_API_URL: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com'
}; 
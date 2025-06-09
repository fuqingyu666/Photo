import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import env from './config/env';

// 导入路由
import authRoutes from './routes/auth';
import photoRoutes from './routes/photo';
import uploadRoutes from './routes/upload';
import shareRoutes from './routes/share';
import aiRoutes from './routes/ai';
import commentRoutes from './routes/comment';

// 导入socket.io控制器
import { setSocketIO as setUploadSocketIO } from './controllers/upload';
import { setSocketIO as setAiSocketIO } from './controllers/ai';
import { setSocketIO as setCommentSocketIO } from './controllers/comment';

// 创建Express应用
const app = express();
const httpServer = createServer(app);

// 创建Socket.io服务器
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// 将Socket.io连接到控制器
setUploadSocketIO(io);
setAiSocketIO(io);
setCommentSocketIO(io);

// 如果上传目录不存在，则创建
try {
    if (!fs.existsSync(env.UPLOAD_DIR)) {
        fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
    }
} catch (error) {
    console.error('Failed to create upload directory:', error);
    process.exit(1);
}

// 中间件
// 暂时移除helmet，因为它可能导致图片的CORS问题
// app.use(helmet());
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件配置和CORS设置
app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(path.join(env.UPLOAD_DIR)));

// 路由设置
app.use('/api/auth', authRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/comments', commentRoutes);

// 添加API端点别名，兼容前端
app.use('/api/photos/upload', (req, res, next) => {
    req.url = '/';
    uploadRoutes(req, res, next);
});

// 修复完成上传端点，正确处理认证
const { authenticate } = require('./middleware/auth');
app.use('/api/photos/finish-upload', authenticate, (req, res, next) => {
    req.url = '/complete';
    uploadRoutes(req, res, next);
});

// 健康检查路由
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io连接处理器
io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // 处理上传进度事件
    socket.on('join-upload-room', (uploadId) => {
        socket.join(`upload-${uploadId}`);
    });

    // 处理AI聊天室
    socket.on('join-ai-chat', (userId) => {
        socket.join(`ai-chat-${userId}`);
    });

    // 处理照片评论室
    socket.on('join-photo-room', (photoId) => {
        socket.join(`photo-${photoId}`);
        console.log(`User joined photo room: photo-${photoId}`);
    });

    // 处理断开连接
    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
    });
});

// 捕获404错误并转发到错误处理器
app.use((req, res, next) => {
    const err: any = new Error('Not Found');
    err.statusCode = 404;
    next(err);
});

// 错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: {
            message: err.message || 'Internal Server Error',
            status: statusCode
        }
    });
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // 给服务器一个宽限期来完成待处理的请求
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // 这里不需要退出，因为不会导致应用崩溃
});

// 启动服务器
const PORT = env.PORT;
httpServer.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}，模式：${env.NODE_ENV}`);
    console.log(`API健康检查: http://localhost:${PORT}/api/health`);
});

export default app; 
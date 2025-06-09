import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import env from './config/env';

// Import routes
import authRoutes from './routes/auth';
import photoRoutes from './routes/photo';
import uploadRoutes from './routes/upload';
import shareRoutes from './routes/share';
import aiRoutes from './routes/ai';
import commentRoutes from './routes/comment';

// Import socket.io controllers
import { setSocketIO as setUploadSocketIO } from './controllers/upload';
import { setSocketIO as setAiSocketIO } from './controllers/ai';
import { setSocketIO as setCommentSocketIO } from './controllers/comment';

// Create Express app
const app = express();
const httpServer = createServer(app);

// Create Socket.io server
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Connect Socket.io with controllers
setUploadSocketIO(io);
setAiSocketIO(io);
setCommentSocketIO(io);

// Create uploads directory if it doesn't exist
try {
    if (!fs.existsSync(env.UPLOAD_DIR)) {
        fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
    }
} catch (error) {
    console.error('Failed to create upload directory:', error);
    process.exit(1);
}

// Middleware
// Removed helmet temporarily as it can cause CORS issues with images
// app.use(helmet());
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files with CORS configuration
app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(path.join(env.UPLOAD_DIR)));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/comments', commentRoutes);

// Add API endpoint aliases for compatibility with frontend
app.use('/api/photos/upload', (req, res, next) => {
    req.url = '/';
    uploadRoutes(req, res, next);
});

// Fix the finish-upload endpoint to properly handle authentication
const { authenticate } = require('./middleware/auth');
app.use('/api/photos/finish-upload', authenticate, (req, res, next) => {
    req.url = '/complete';
    uploadRoutes(req, res, next);
});

// Health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io connection handler
io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Handle upload progress events
    socket.on('join-upload-room', (uploadId) => {
        socket.join(`upload-${uploadId}`);
    });

    // Handle AI chat room
    socket.on('join-ai-chat', (userId) => {
        socket.join(`ai-chat-${userId}`);
    });

    // Handle photo comment room
    socket.on('join-photo-room', (photoId) => {
        socket.join(`photo-${photoId}`);
        console.log(`User joined photo room: photo-${photoId}`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
    });
});

// Catch 404 and forward to error handler
app.use((req, res, next) => {
    const err: any = new Error('Not Found');
    err.statusCode = 404;
    next(err);
});

// Error handling middleware
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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Give the server a grace period to finish pending requests
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // No need to exit here as this won't crash the app
});

// Start the server
const PORT = env.PORT;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${env.NODE_ENV} mode`);
    console.log(`API Health check: http://localhost:${PORT}/api/health`);
});

export default app; 
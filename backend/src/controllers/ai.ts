import { Request, Response } from 'express';
import { Server as SocketServer } from 'socket.io';
import { AIModel } from '../models/ai';
import { PhotoModel } from '../models/photo';

// 存储 socket.io 实例
let io: SocketServer;

// 设置 socket.io 实例
export const setSocketIO = (socketIO: SocketServer) => {
    io = socketIO;
};

/**
 * 使用 AI 分析照片
 */
export const analyzePhoto = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const photoId = req.params.id;

        // 检查照片是否存在且用户是否有访问权限
        const photo = await PhotoModel.findById(photoId);
        if (!photo) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        // 检查用户是否有权访问此照片
        const isOwner = photo.user_id === req.user.id;
        const isShared = await PhotoModel.isSharedWithUser(photoId, req.user.id);

        if (!isOwner && !isShared) {
            return res.status(403).json({ error: 'You do not have permission to analyze this photo' });
        }

        // 生成照片 URL
        const photoUrl = `${req.protocol}://${req.get('host')}/uploads/${photo.filename}`;

        // 分析照片
        const analysis = await AIModel.analyzePhoto(photoId, photoUrl);

        res.json({ analysis: analysis.analysis_data });
    } catch (error) {
        console.error('Error analyzing photo:', error);
        res.status(500).json({ error: 'Failed to analyze photo' });
    }
};

/**
 * 获取照片的 AI 分析结果
 */
export const getPhotoAnalysis = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const photoId = req.params.id;

        // 检查照片是否存在且用户是否有访问权限
        const photo = await PhotoModel.findById(photoId);
        if (!photo) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        // 检查用户是否有权访问此照片
        const isOwner = photo.user_id === req.user.id;
        const isShared = await PhotoModel.isSharedWithUser(photoId, req.user.id);

        if (!isOwner && !isShared) {
            return res.status(403).json({ error: 'You do not have permission to view this photo analysis' });
        }

        // 获取分析结果
        const analysis = await AIModel.findByPhotoId(photoId);

        if (!analysis) {
            return res.status(404).json({ error: 'Analysis not found' });
        }

        res.json({ analysis: analysis.analysis_data });
    } catch (error) {
        console.error('Error getting photo analysis:', error);
        res.status(500).json({ error: 'Failed to get photo analysis' });
    }
};

/**
 * 为照片生成标签
 */
export const generateTags = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const photoId = req.params.id;

        // 检查照片是否存在且用户是否有访问权限
        const photo = await PhotoModel.findById(photoId);
        if (!photo) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        // 检查用户是否有权访问此照片
        const isOwner = photo.user_id === req.user.id;
        const isShared = await PhotoModel.isSharedWithUser(photoId, req.user.id);

        if (!isOwner && !isShared) {
            return res.status(403).json({ error: 'You do not have permission to generate tags for this photo' });
        }

        // 生成标签
        const tags = await AIModel.generateTags(photoId);

        res.json({ tags });
    } catch (error) {
        console.error('Error generating tags:', error);
        res.status(500).json({ error: 'Failed to generate tags' });
    }
};

/**
 * 与 AI 聊天
 */
export const chat = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { message, context } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // 如果提供了上下文，则进行验证
        let validatedContext: Array<{ role: string, content: string }> = [];
        if (Array.isArray(context)) {
            validatedContext = context
                .filter(msg =>
                    msg && typeof msg === 'object' &&
                    ['system', 'user', 'assistant'].includes(msg.role) &&
                    typeof msg.content === 'string'
                )
                .slice(-10); // 限制上下文为最后 10 条消息
        }

        // 检查客户端是否需要流式响应
        const acceptsStreaming = req.headers.accept === 'text/event-stream';

        if (acceptsStreaming) {
            // 设置 SSE 头信息
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();

            // 发送 SSE 事件的函数
            const sendEvent = (data: string) => {
                res.write(`data: ${JSON.stringify({ content: data })}\n\n`);
                // 显式转换为 any 类型，因为某些 Express 响应实现有 flush() 方法
                (res as any).flush?.();
            };

            // 发送初始事件
            sendEvent('[START]');

            try {
                // 流式传输聊天响应
                const chatMessage = await AIModel.streamChat(req.user.id, message, validatedContext, (chunk) => {
                    sendEvent(chunk);
                });

                // 发送最终事件并结束响应
                sendEvent('[DONE]');
                res.end();

                // 通过 socket.io 发送聊天消息
                if (io) {
                    io.to(`ai-chat-${req.user.id}`).emit('ai-chat-message', chatMessage);
                }
            } catch (error) {
                console.error('Error streaming chat:', error);
                sendEvent('[ERROR] ' + (error instanceof Error ? error.message : 'Unknown error'));
                res.end();
            }
        } else {
            // 常规非流式聊天
            const chatMessage = await AIModel.chat(req.user.id, message, validatedContext);

            // 通过 socket.io 发送聊天消息
            if (io) {
                io.to(`ai-chat-${req.user.id}`).emit('ai-chat-message', chatMessage);
            }

            res.json({
                message: chatMessage.message,
                response: chatMessage.response,
                id: chatMessage.id
            });
        }
    } catch (error) {
        console.error('Error chatting with AI:', error);
        res.status(500).json({ error: 'Failed to chat with AI' });
    }
};

/**
 * 获取聊天历史
 */
export const getChatHistory = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

        // 验证限制参数
        if (isNaN(limit) || limit < 1 || limit > 100) {
            return res.status(400).json({ error: 'Invalid limit parameter' });
        }

        try {
            // 获取聊天历史
            const chatHistory = await AIModel.getChatHistory(req.user.id, limit);
            res.json({ messages: chatHistory });
        } catch (dbError) {
            console.error('Database error when getting chat history:', dbError);
            // 如果表不存在，则返回空消息
            res.json({ messages: [] });
        }
    } catch (error) {
        console.error('Error getting chat history:', error);
        res.status(500).json({ error: 'Failed to get chat history' });
    }
}; 
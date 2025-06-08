import { Request, Response } from 'express';
import { Server as SocketServer } from 'socket.io';
import { AIModel } from '../models/ai';
import { PhotoModel } from '../models/photo';

// Store socket.io instance
let io: SocketServer;

// Set socket.io instance
export const setSocketIO = (socketIO: SocketServer) => {
    io = socketIO;
};

/**
 * Analyze a photo using AI
 */
export const analyzePhoto = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const photoId = req.params.id;

        // Check if photo exists and user has access
        const photo = await PhotoModel.findById(photoId);
        if (!photo) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        // Check if user has access to this photo
        const isOwner = photo.user_id === req.user.id;
        const isShared = await PhotoModel.isSharedWithUser(photoId, req.user.id);

        if (!isOwner && !isShared) {
            return res.status(403).json({ error: 'You do not have permission to analyze this photo' });
        }

        // Generate photo URL
        const photoUrl = `${req.protocol}://${req.get('host')}/uploads/${photo.filename}`;

        // Analyze photo
        const analysis = await AIModel.analyzePhoto(photoId, photoUrl);

        res.json({ analysis: analysis.analysis_data });
    } catch (error) {
        console.error('Error analyzing photo:', error);
        res.status(500).json({ error: 'Failed to analyze photo' });
    }
};

/**
 * Get AI analysis for a photo
 */
export const getPhotoAnalysis = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const photoId = req.params.id;

        // Check if photo exists and user has access
        const photo = await PhotoModel.findById(photoId);
        if (!photo) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        // Check if user has access to this photo
        const isOwner = photo.user_id === req.user.id;
        const isShared = await PhotoModel.isSharedWithUser(photoId, req.user.id);

        if (!isOwner && !isShared) {
            return res.status(403).json({ error: 'You do not have permission to view this photo analysis' });
        }

        // Get analysis
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
 * Generate tags for a photo
 */
export const generateTags = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const photoId = req.params.id;

        // Check if photo exists and user has access
        const photo = await PhotoModel.findById(photoId);
        if (!photo) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        // Check if user has access to this photo
        const isOwner = photo.user_id === req.user.id;
        const isShared = await PhotoModel.isSharedWithUser(photoId, req.user.id);

        if (!isOwner && !isShared) {
            return res.status(403).json({ error: 'You do not have permission to generate tags for this photo' });
        }

        // Generate tags
        const tags = await AIModel.generateTags(photoId);

        res.json({ tags });
    } catch (error) {
        console.error('Error generating tags:', error);
        res.status(500).json({ error: 'Failed to generate tags' });
    }
};

/**
 * Chat with AI
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

        // Validate context if provided
        let validatedContext: Array<{ role: string, content: string }> = [];
        if (Array.isArray(context)) {
            validatedContext = context
                .filter(msg =>
                    msg && typeof msg === 'object' &&
                    ['system', 'user', 'assistant'].includes(msg.role) &&
                    typeof msg.content === 'string'
                )
                .slice(-10); // Limit context to last 10 messages
        }

        // Check if the client wants streaming response
        const acceptsStreaming = req.headers.accept === 'text/event-stream';

        if (acceptsStreaming) {
            // Set headers for SSE
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();

            // Function to send SSE events
            const sendEvent = (data: string) => {
                res.write(`data: ${JSON.stringify({ content: data })}\n\n`);
                // Explicitly cast to any since some Express response implementations have flush()
                (res as any).flush?.();
            };

            // Send initial event
            sendEvent('[START]');

            try {
                // Stream chat response
                const chatMessage = await AIModel.streamChat(req.user.id, message, validatedContext, (chunk) => {
                    sendEvent(chunk);
                });

                // Send final event and end response
                sendEvent('[DONE]');
                res.end();

                // Emit chat message via socket.io
                if (io) {
                    io.to(`ai-chat-${req.user.id}`).emit('ai-chat-message', chatMessage);
                }
            } catch (error) {
                console.error('Error streaming chat:', error);
                sendEvent('[ERROR] ' + (error instanceof Error ? error.message : 'Unknown error'));
                res.end();
            }
        } else {
            // Regular non-streaming chat
            const chatMessage = await AIModel.chat(req.user.id, message, validatedContext);

            // Emit chat message via socket.io
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
 * Get chat history
 */
export const getChatHistory = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

        // Validate limit
        if (isNaN(limit) || limit < 1 || limit > 100) {
            return res.status(400).json({ error: 'Invalid limit parameter' });
        }

        try {
            // Get chat history
            const chatHistory = await AIModel.getChatHistory(req.user.id, limit);
            res.json({ messages: chatHistory });
        } catch (dbError) {
            console.error('Database error when getting chat history:', dbError);
            // Return empty messages if table doesn't exist yet
            res.json({ messages: [] });
        }
    } catch (error) {
        console.error('Error getting chat history:', error);
        res.status(500).json({ error: 'Failed to get chat history' });
    }
}; 
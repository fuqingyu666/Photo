import { Request, Response } from 'express';
import { Server as SocketServer } from 'socket.io';
import { CommentModel } from '../models/comment';

// Store socket.io instance
let io: SocketServer;

// Set socket.io instance
export const setSocketIO = (socketIO: SocketServer) => {
    io = socketIO;
};

/**
 * Get comments for a photo
 */
export const getComments = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const photoId = req.params.photoId;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

        // Validate limit
        if (isNaN(limit) || limit < 1 || limit > 500) {
            return res.status(400).json({ error: 'Invalid limit parameter' });
        }

        const comments = await CommentModel.getByPhotoId(photoId, limit);

        res.json({ comments });
    } catch (error) {
        console.error('Error getting comments:', error);
        res.status(500).json({ error: 'Failed to get comments' });
    }
};

/**
 * Create a new comment
 */
export const createComment = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const photoId = req.params.photoId;
        const { content } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Comment content is required' });
        }

        // Create comment
        const comment = await CommentModel.create({
            photo_id: photoId,
            user_id: req.user.id,
            content: content.trim()
        });

        // Add user info to the comment
        const commentWithUser = {
            ...comment,
            username: req.user.username
        };

        // Emit Socket.IO event
        if (io) {
            io.to(`photo-${photoId}`).emit('new-comment', commentWithUser);
        }

        res.status(201).json({ comment: commentWithUser });
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ error: 'Failed to create comment' });
    }
};

/**
 * Delete a comment
 */
export const deleteComment = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const commentId = req.params.commentId;
        const photoId = req.params.photoId;

        // Find the comment to verify ownership
        const comment = await CommentModel.findById(commentId);
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Check if user owns the comment
        if (comment.user_id !== req.user.id) {
            return res.status(403).json({ error: 'You do not have permission to delete this comment' });
        }

        // Delete the comment
        await CommentModel.delete(commentId);

        // Emit Socket.IO event
        if (io) {
            io.to(`photo-${photoId}`).emit('delete-comment', { commentId });
        }

        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
}; 
import { Request, Response } from 'express';
import { PhotoModel } from '../models/photo';
import { AIModel } from '../models/ai';
import env from '../config/env';
import pool from '../config/database';

/**
 * Get all photos for the current user
 */
export const getUserPhotos = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Pagination
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        // Get photos
        const photos = await PhotoModel.findByUserId(req.user.id, limit, offset);
        const total = await PhotoModel.countByUserId(req.user.id);

        // Add photo URLs
        const photosWithUrls = photos.map(photo => ({
            ...photo,
            url: `${req.protocol}://${req.get('host')}/uploads/${photo.filename}`
        }));

        res.json({
            photos: photosWithUrls,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error getting user photos:', error);
        res.status(500).json({ error: 'Failed to get photos' });
    }
};

/**
 * Get shared photos for the current user
 */
export const getSharedPhotos = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Pagination
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        // 确保limit和offset是安全的数字
        const safeLimit = Math.min(Math.max(1, limit), 100);
        const safeOffset = Math.max(0, offset);

        // Get all publicly shared photos that are not private
        // Modified to get ALL shared photos, not just those directly shared with this user
        const [rows] = await pool.execute(
            `SELECT p.*, u.username 
             FROM photos p
             JOIN users u ON p.user_id = u.id
             WHERE p.is_shared = 1 AND p.is_private = 0
             ORDER BY p.created_at DESC
             LIMIT ${safeLimit} OFFSET ${safeOffset}`,
            []
        );

        const photos = rows as any[];

        // Count total shared photos
        const [countRows] = await pool.execute(
            `SELECT COUNT(*) as count 
             FROM photos 
             WHERE is_shared = 1 AND is_private = 0`
        );

        const total = (countRows as any[])[0].count;

        // Add photo URLs
        const photosWithUrls = photos.map(photo => ({
            ...photo,
            url: `${req.protocol}://${req.get('host')}/uploads/${photo.filename}`
        }));

        res.json({
            photos: photosWithUrls,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error getting shared photos:', error);
        res.status(500).json({ error: 'Failed to get shared photos' });
    }
};

/**
 * Get a single photo by ID
 */
export const getPhotoById = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const photoId = req.params.id;

        // Get photo with user info
        const photo = await PhotoModel.findByIdWithUser(photoId);
        if (!photo) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        // Check if user has access to this photo
        const isOwner = photo.user_id === req.user.id;
        const isSharedWithUser = await PhotoModel.isSharedWithUser(photoId, req.user.id);
        const isPubliclyShared = photo.is_shared && !photo.is_private;

        if (!isOwner && !isSharedWithUser && !isPubliclyShared) {
            return res.status(403).json({ error: 'You do not have permission to view this photo' });
        }

        // Add photo URL
        const photoWithUrl = {
            ...photo,
            url: `${req.protocol}://${req.get('host')}/uploads/${photo.filename}`
        };

        // Get AI analysis if available
        let analysis = null;
        try {
            analysis = await AIModel.findByPhotoId(photoId);
        } catch (analysisError) {
            console.error('Error retrieving AI analysis:', analysisError);
            // Continue without AI analysis
        }

        res.json({
            photo: photoWithUrl,
            analysis: analysis ? analysis.analysis_data : null
        });
    } catch (error) {
        console.error('Error getting photo:', error);
        res.status(500).json({ error: 'Failed to get photo' });
    }
};

/**
 * Create a new photo entry after upload is complete
 */
export const createPhoto = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { title, description, filename, original_filename, file_size, file_type, file_hash } = req.body;

        // Validate required fields
        if (!title || !filename || !original_filename || !file_size || !file_type || !file_hash) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Create photo
        const photo = await PhotoModel.create({
            user_id: req.user.id,
            title,
            description,
            filename,
            original_filename,
            file_size,
            file_type,
            file_hash
        });

        // Add photo URL
        const photoWithUrl = {
            ...photo,
            url: `${req.protocol}://${req.get('host')}/uploads/${photo.filename}`
        };

        // Trigger AI analysis in background
        const photoUrl = `${req.protocol}://${req.get('host')}/uploads/${photo.filename}`;
        AIModel.analyzePhoto(photo.id, photoUrl).catch(err => {
            console.error('Error analyzing photo:', err);
        });

        res.status(201).json({ photo: photoWithUrl });
    } catch (error) {
        console.error('Error creating photo:', error);
        res.status(500).json({ error: 'Failed to create photo' });
    }
};

/**
 * Update a photo
 */
export const updatePhoto = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const photoId = req.params.id;
        const { title, description } = req.body;

        // Check if user owns photo
        const isOwner = await PhotoModel.isOwner(photoId, req.user.id);
        if (!isOwner) {
            return res.status(403).json({ error: 'You do not have permission to update this photo' });
        }

        // Update photo
        const updatedPhoto = await PhotoModel.update(photoId, { title, description });
        if (!updatedPhoto) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        // Add photo URL
        const photoWithUrl = {
            ...updatedPhoto,
            url: `${req.protocol}://${req.get('host')}/uploads/${updatedPhoto.filename}`
        };

        res.json({ photo: photoWithUrl });
    } catch (error) {
        console.error('Error updating photo:', error);
        res.status(500).json({ error: 'Failed to update photo' });
    }
};

/**
 * Delete a photo
 */
export const deletePhoto = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const photoId = req.params.id;

        // Check if user owns photo
        const isOwner = await PhotoModel.isOwner(photoId, req.user.id);
        if (!isOwner) {
            return res.status(403).json({ error: 'You do not have permission to delete this photo' });
        }

        // Delete photo
        const deleted = await PhotoModel.delete(photoId);
        if (!deleted) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        res.json({ message: 'Photo deleted successfully' });
    } catch (error) {
        console.error('Error deleting photo:', error);
        res.status(500).json({ error: 'Failed to delete photo' });
    }
};

/**
 * Share a photo with another user
 */
export const sharePhoto = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const photoId = req.params.id;
        const { sharedWithUserId } = req.body;

        if (!sharedWithUserId) {
            return res.status(400).json({ error: 'User ID to share with is required' });
        }

        // Check if user owns photo
        const isOwner = await PhotoModel.isOwner(photoId, req.user.id);
        if (!isOwner) {
            return res.status(403).json({ error: 'You do not have permission to share this photo' });
        }

        // Share photo
        await PhotoModel.shareWithUser(photoId, req.user.id, sharedWithUserId);

        // Also update the photo to mark it as shared
        await PhotoModel.update(photoId, { is_shared: true });

        res.json({ message: 'Photo shared successfully' });
    } catch (error) {
        console.error('Error sharing photo:', error);
        res.status(500).json({ error: 'Failed to share photo' });
    }
};

/**
 * Unshare a photo with another user
 */
export const unsharePhoto = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const photoId = req.params.id;
        const { sharedWithUserId } = req.body;

        if (!sharedWithUserId) {
            return res.status(400).json({ error: 'User ID to unshare with is required' });
        }

        // Check if user owns photo
        const isOwner = await PhotoModel.isOwner(photoId, req.user.id);
        if (!isOwner) {
            return res.status(403).json({ error: 'You do not have permission to unshare this photo' });
        }

        // Unshare photo
        await PhotoModel.unshareWithUser(photoId, sharedWithUserId);

        res.json({ message: 'Photo unshared successfully' });
    } catch (error) {
        console.error('Error unsharing photo:', error);
        res.status(500).json({ error: 'Failed to unshare photo' });
    }
}; 
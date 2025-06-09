import { Request, Response } from 'express';
import { PhotoModel } from '../models/photo';
import { AIModel } from '../models/ai';
import env from '../config/env';
import pool from '../config/database';

/**
 * 获取当前用户的所有照片
 */
export const getUserPhotos = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // 分页
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        // 获取照片
        const photos = await PhotoModel.findByUserId(req.user.id, limit, offset);
        const total = await PhotoModel.countByUserId(req.user.id);

        // 添加照片URL
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
 * 获取与当前用户共享的照片
 */
export const getSharedPhotos = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // 分页
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        // 确保limit和offset是安全的数字
        const safeLimit = Math.min(Math.max(1, limit), 100);
        const safeOffset = Math.max(0, offset);

        // 获取所有公开共享且非私有的照片
        // 修改为获取所有共享照片，而不仅仅是直接与此用户共享的照片
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

        // 计算共享照片总数
        const [countRows] = await pool.execute(
            `SELECT COUNT(*) as count 
             FROM photos 
             WHERE is_shared = 1 AND is_private = 0`
        );

        const total = (countRows as any[])[0].count;

        // 添加照片URL
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
 * 通过ID获取单张照片
 */
export const getPhotoById = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const photoId = req.params.id;

        // 获取带有用户信息的照片
        const photo = await PhotoModel.findByIdWithUser(photoId);
        if (!photo) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        // 检查用户是否有权访问此照片
        const isOwner = photo.user_id === req.user.id;
        const isSharedWithUser = await PhotoModel.isSharedWithUser(photoId, req.user.id);
        const isPubliclyShared = photo.is_shared && !photo.is_private;

        if (!isOwner && !isSharedWithUser && !isPubliclyShared) {
            return res.status(403).json({ error: 'You do not have permission to view this photo' });
        }

        // 添加照片URL
        const photoWithUrl = {
            ...photo,
            url: `${req.protocol}://${req.get('host')}/uploads/${photo.filename}`
        };

        // 获取AI分析结果（如果有）
        let analysis = null;
        try {
            analysis = await AIModel.findByPhotoId(photoId);
        } catch (analysisError) {
            console.error('Error retrieving AI analysis:', analysisError);
            // 继续执行，不带AI分析
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
 * 上传完成后创建新的照片条目
 */
export const createPhoto = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { title, description, filename, original_filename, file_size, file_type, file_hash } = req.body;

        // 验证必填字段
        if (!title || !filename || !original_filename || !file_size || !file_type || !file_hash) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 创建照片
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

        // 添加照片URL
        const photoWithUrl = {
            ...photo,
            url: `${req.protocol}://${req.get('host')}/uploads/${photo.filename}`
        };

        // 在后台触发AI分析
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
 * 更新照片
 */
export const updatePhoto = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const photoId = req.params.id;
        const { title, description } = req.body;

        // 检查用户是否拥有照片
        const isOwner = await PhotoModel.isOwner(photoId, req.user.id);
        if (!isOwner) {
            return res.status(403).json({ error: 'You do not have permission to update this photo' });
        }

        // 更新照片
        const updatedPhoto = await PhotoModel.update(photoId, { title, description });
        if (!updatedPhoto) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        // 添加照片URL
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
 * 删除照片
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
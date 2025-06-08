import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Server as SocketServer } from 'socket.io';
import { UploadModel } from '../models/upload';
import { PhotoModel } from '../models/photo';
import env from '../config/env';

// Configure multer for temporary storage
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB per chunk
    }
});

// Export multer middleware for route usage
export const uploadMiddleware = upload.single('chunk');

// Store socket.io instance
let io: SocketServer;

// Set socket.io instance
export const setSocketIO = (socketIO: SocketServer) => {
    io = socketIO;
};

/**
 * Initialize a new upload
 */
export const initUpload = async (req: Request, res: Response) => {
    try {
        console.log("上传初始化请求收到");
        console.log("用户:", req.user);
        console.log("文件:", req.file);
        console.log("请求体:", req.body);

        if (!req.user) {
            return res.status(401).json({ error: '未认证，请先登录' });
        }

        if (!req.file) {
            return res.status(400).json({ error: '没有提供文件' });
        }

        // 使用文件信息初始化上传
        const upload = await UploadModel.initUpload({
            user_id: req.user.id,
            original_filename: req.file.originalname,
            file_size: req.file.size,
            file_type: req.file.mimetype,
            file_hash: Date.now().toString(), // 简单时间戳，实际应该计算文件hash
            chunks_total: 1 // 简化处理，只需要一个分块
        });

        // 直接保存这个文件作为第一个分块
        await UploadModel.uploadChunk(
            upload.id,
            0, // 第一个分块索引
            upload.id.substring(0, 30) + '0', // 缩短的chunk_hash，确保不超过32个字符
            req.file.buffer
        );

        // 更新上传状态为已完成
        await UploadModel.updateStatus(upload.id, 'completed');

        // 合并分块（虽然只有一个分块）
        const filename = await UploadModel.mergeChunks(upload.id);

        // 创建photo记录
        const photo = await PhotoModel.create({
            user_id: req.user.id,
            title: req.file.originalname.split('.')[0] || '未命名照片',
            description: '',
            filename,
            original_filename: req.file.originalname,
            file_size: req.file.size,
            file_type: req.file.mimetype,
            file_hash: upload.file_hash,
            width: 0,
            height: 0,
            is_private: false,
            is_shared: true
        });

        // 返回成功结果
        res.status(201).json({
            upload,
            photo,
            url: `${req.protocol}://${req.get('host')}/uploads/${filename}`
        });
    } catch (error: any) {
        console.error('初始化上传失败:', error);
        res.status(500).json({
            error: '初始化上传失败',
            details: error.message,
            stack: error.stack
        });
    }
};

/**
 * Upload a chunk
 */
export const uploadChunk = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No chunk file provided' });
        }

        // 从URL参数或请求体获取upload_id
        const upload_id = req.params.id || req.body.upload_id;
        const { chunk_index, chunk_hash } = req.body;

        // Validate required fields
        if (!upload_id || chunk_index === undefined || !chunk_hash) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if user owns this upload
        const isOwner = await UploadModel.isOwner(upload_id, req.user.id);
        if (!isOwner) {
            return res.status(403).json({ error: 'You do not have permission to access this upload' });
        }

        // Upload chunk
        const chunk = await UploadModel.uploadChunk(
            upload_id,
            parseInt(chunk_index),
            chunk_hash,
            req.file.buffer
        );

        // Get upload progress
        const progress = await UploadModel.getProgress(upload_id);

        // Emit upload progress event via socket.io
        if (io) {
            io.to(`upload-${upload_id}`).emit('upload-progress', {
                upload_id,
                ...progress
            });
        }

        res.json({
            chunk,
            progress
        });
    } catch (error) {
        console.error('Error uploading chunk:', error);
        res.status(500).json({ error: 'Failed to upload chunk' });
    }
};

/**
 * Complete upload and merge chunks
 */
export const completeUpload = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { upload_id } = req.body;

        // Validate required fields
        if (!upload_id) {
            return res.status(400).json({ error: 'Upload ID is required' });
        }

        // Check if user owns this upload
        const isOwner = await UploadModel.isOwner(upload_id, req.user.id);
        if (!isOwner) {
            return res.status(403).json({ error: 'You do not have permission to access this upload' });
        }

        // Merge chunks
        const filename = await UploadModel.mergeChunks(upload_id);

        // Get upload record
        const upload = await UploadModel.findById(upload_id);

        // Emit upload completed event via socket.io
        if (io) {
            io.to(`upload-${upload_id}`).emit('upload-completed', {
                upload_id,
                filename
            });
        }

        res.json({
            message: 'Upload completed successfully',
            upload,
            filename,
            url: `${req.protocol}://${req.get('host')}/uploads/${filename}`
        });
    } catch (error) {
        console.error('Error completing upload:', error);
        res.status(500).json({ error: 'Failed to complete upload' });
    }
};

/**
 * Get upload status
 */
export const getUploadStatus = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const uploadId = req.params.id;

        // Check if user owns this upload
        const isOwner = await UploadModel.isOwner(uploadId, req.user.id);
        if (!isOwner) {
            return res.status(403).json({ error: 'You do not have permission to access this upload' });
        }

        // Get upload record
        const upload = await UploadModel.findById(uploadId);
        if (!upload) {
            return res.status(404).json({ error: 'Upload not found' });
        }

        // Get progress
        const progress = await UploadModel.getProgress(uploadId);

        res.json({
            upload,
            progress
        });
    } catch (error) {
        console.error('Error getting upload status:', error);
        res.status(500).json({ error: 'Failed to get upload status' });
    }
};

/**
 * Update upload status (pause/resume)
 */
export const updateUploadStatus = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const uploadId = req.params.id;
        const { status } = req.body;

        // Validate status
        if (!status || !['pending', 'uploading', 'paused', 'completed', 'error'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Check if user owns this upload
        const isOwner = await UploadModel.isOwner(uploadId, req.user.id);
        if (!isOwner) {
            return res.status(403).json({ error: 'You do not have permission to access this upload' });
        }

        // Update status
        await UploadModel.updateStatus(uploadId, status);

        // Get updated upload record
        const upload = await UploadModel.findById(uploadId);

        // Emit upload status update event via socket.io
        if (io) {
            io.to(`upload-${uploadId}`).emit('upload-status-updated', {
                upload_id: uploadId,
                status
            });
        }

        res.json({ upload });
    } catch (error) {
        console.error('Error updating upload status:', error);
        res.status(500).json({ error: 'Failed to update upload status' });
    }
};

/**
 * Delete upload
 */
export const deleteUpload = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const uploadId = req.params.id;

        // Check if user owns this upload
        const isOwner = await UploadModel.isOwner(uploadId, req.user.id);
        if (!isOwner) {
            return res.status(403).json({ error: 'You do not have permission to access this upload' });
        }

        // Delete upload
        const deleted = await UploadModel.delete(uploadId);
        if (!deleted) {
            return res.status(404).json({ error: 'Upload not found' });
        }

        res.json({ message: 'Upload deleted successfully' });
    } catch (error) {
        console.error('Error deleting upload:', error);
        res.status(500).json({ error: 'Failed to delete upload' });
    }
};

/**
 * Get user uploads
 */
export const getUserUploads = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Get uploads
        const uploads = await UploadModel.findByUserId(req.user.id);

        res.json({ uploads });
    } catch (error) {
        console.error('Error getting user uploads:', error);
        res.status(500).json({ error: 'Failed to get uploads' });
    }
}; 
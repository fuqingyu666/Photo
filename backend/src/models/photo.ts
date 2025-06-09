import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';

export interface Photo {
    id: string;
    user_id: string;
    title: string;
    description?: string;
    filename: string;
    original_filename: string;
    file_size: number;
    file_type: string;
    file_hash: string;
    width?: number;
    height?: number;
    is_private: boolean;
    is_shared: boolean;
    created_at?: Date;
    updated_at?: Date;
}

export interface PhotoWithUser extends Photo {
    username: string;
}

export interface PhotoCreate {
    user_id: string;
    title: string;
    description?: string;
    filename: string;
    original_filename: string;
    file_size: number;
    file_type: string;
    file_hash: string;
    width?: number;
    height?: number;
    is_private?: boolean;
    is_shared?: boolean;
}

export class PhotoModel {
    /**
     * 创建新照片
     */
    static async create(photoData: PhotoCreate): Promise<Photo> {
        const id = uuidv4();

        const {
            user_id,
            title,
            description,
            filename,
            original_filename,
            file_size,
            file_type,
            file_hash,
            width,
            height,
            is_private = false,
            is_shared = true
        } = photoData;

        await pool.execute(
            `INSERT INTO photos (
        id, user_id, title, description, filename, original_filename, 
        file_size, file_type, file_hash, width, height, is_private, is_shared
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, user_id, title, description, filename, original_filename,
                file_size, file_type, file_hash, width, height, is_private ? 1 : 0, is_shared ? 1 : 0
            ]
        );

        return {
            id,
            ...photoData,
            is_private: !!is_private,
            is_shared: is_shared !== false
        };
    }

    /**
     * 通过ID查找照片
     */
    static async findById(id: string): Promise<Photo | null> {
        const [rows] = await pool.execute(
            'SELECT * FROM photos WHERE id = ?',
            [id]
        );

        const photos = rows as Photo[];
        return photos.length > 0 ? photos[0] : null;
    }

    /**
     * 通过ID查找照片，并包含用户信息
     */
    static async findByIdWithUser(id: string): Promise<PhotoWithUser | null> {
        const [rows] = await pool.execute(
            `SELECT p.*, u.username 
       FROM photos p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
            [id]
        );

        const photos = rows as PhotoWithUser[];
        return photos.length > 0 ? photos[0] : null;
    }

    /**
     * 通过用户ID查找照片
     */
    static async findByUserId(userId: string, limit: number = 20, offset: number = 0): Promise<Photo[]> {
        // 确保limit和offset是安全的数字
        const safeLimit = Math.min(Math.max(1, limit), 100);
        const safeOffset = Math.max(0, offset);

        const [rows] = await pool.execute(
            `SELECT * FROM photos WHERE user_id = ? ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
            [userId]
        );

        return rows as Photo[];
    }

    /**
     * 统计用户的照片数量
     */
    static async countByUserId(userId: string): Promise<number> {
        const [rows] = await pool.execute(
            'SELECT COUNT(*) as count FROM photos WHERE user_id = ?',
            [userId]
        );

        return (rows as any[])[0].count;
    }

    /**
     * 查找与用户共享的照片
     */
    static async findSharedWithUser(userId: string, limit: number = 20, offset: number = 0): Promise<PhotoWithUser[]> {
        // 确保limit和offset是安全的数字
        const safeLimit = Math.min(Math.max(1, limit), 100);
        const safeOffset = Math.max(0, offset);

        const [rows] = await pool.execute(
            `SELECT p.*, u.username 
       FROM photos p
       JOIN users u ON p.user_id = u.id
       JOIN photo_shares ps ON p.id = ps.photo_id
       WHERE ps.shared_with = ? AND p.is_shared = 1 AND p.is_private = 0
       ORDER BY ps.created_at DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
            [userId]
        );

        return rows as PhotoWithUser[];
    }

    /**
     * 统计与用户共享的照片数量
     */
    static async countSharedWithUser(userId: string): Promise<number> {
        const [rows] = await pool.execute(
            `SELECT COUNT(*) as count 
       FROM photo_shares 
       WHERE shared_with = ?`,
            [userId]
        );

        return (rows as any[])[0].count;
    }

    /**
     * 更新照片信息
     */
    static async update(id: string, photoData: Partial<Photo>): Promise<Photo | null> {
        // 移除不可变字段
        const { id: _, user_id, filename, original_filename, file_size, file_type, file_hash, ...updateData } = photoData;

        // 构建更新查询
        const entries = Object.entries(updateData).filter(([_, value]) => value !== undefined);
        if (entries.length === 0) {
            return this.findById(id);
        }

        const fields = entries.map(([key, _]) => `${key} = ?`).join(', ');
        const values = entries.map(([_, value]) => value);

        // 更新照片
        await pool.execute(
            `UPDATE photos SET ${fields} WHERE id = ?`,
            [...values, id]
        );

        // 返回更新后的照片
        return this.findById(id);
    }

    /**
     * 删除照片
     */
    static async delete(id: string): Promise<boolean> {
        const [result] = await pool.execute(
            'DELETE FROM photos WHERE id = ?',
            [id]
        ) as any;

        return result.affectedRows > 0;
    }

    /**
     * 检查用户是否为照片所有者
     */
    static async isOwner(photoId: string, userId: string): Promise<boolean> {
        const [rows] = await pool.execute(
            'SELECT id FROM photos WHERE id = ? AND user_id = ?',
            [photoId, userId]
        );

        return (rows as any[]).length > 0;
    }

    /**
     * 检查照片是否与用户共享
     */
    static async isSharedWithUser(photoId: string, userId: string): Promise<boolean> {
        const [rows] = await pool.execute(
            'SELECT id FROM photo_shares WHERE photo_id = ? AND shared_with = ?',
            [photoId, userId]
        );

        return (rows as any[]).length > 0;
    }

    /**
     * 与用户共享照片
     */
    static async shareWithUser(photoId: string, sharedBy: string, sharedWith: string): Promise<boolean> {
        // 检查是否已共享
        const [existingShares] = await pool.execute(
            'SELECT id FROM photo_shares WHERE photo_id = ? AND shared_with = ?',
            [photoId, sharedWith]
        );

        if ((existingShares as any[]).length > 0) {
            return true; // 已经共享
        }

        // Share photo
        const shareId = uuidv4();
        await pool.execute(
            'INSERT INTO photo_shares (id, photo_id, shared_by, shared_with) VALUES (?, ?, ?, ?)',
            [shareId, photoId, sharedBy, sharedWith]
        );

        return true;
    }

    /**
     * Unshare photo with user
     */
    static async unshareWithUser(photoId: string, sharedWith: string): Promise<boolean> {
        const [result] = await pool.execute(
            'DELETE FROM photo_shares WHERE photo_id = ? AND shared_with = ?',
            [photoId, sharedWith]
        ) as any;

        return result.affectedRows > 0;
    }
} 
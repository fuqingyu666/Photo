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
     * Create a new photo
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
     * Find photo by ID
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
     * Find photo by ID with user info
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
     * Find photos by user ID
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
     * Count photos by user ID
     */
    static async countByUserId(userId: string): Promise<number> {
        const [rows] = await pool.execute(
            'SELECT COUNT(*) as count FROM photos WHERE user_id = ?',
            [userId]
        );

        return (rows as any[])[0].count;
    }

    /**
     * Find photos shared with user
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
     * Count photos shared with user
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
     * Update photo
     */
    static async update(id: string, photoData: Partial<Photo>): Promise<Photo | null> {
        // Remove immutable fields
        const { id: _, user_id, filename, original_filename, file_size, file_type, file_hash, ...updateData } = photoData;

        // Build update query
        const entries = Object.entries(updateData).filter(([_, value]) => value !== undefined);
        if (entries.length === 0) {
            return this.findById(id);
        }

        const fields = entries.map(([key, _]) => `${key} = ?`).join(', ');
        const values = entries.map(([_, value]) => value);

        // Update photo
        await pool.execute(
            `UPDATE photos SET ${fields} WHERE id = ?`,
            [...values, id]
        );

        // Return updated photo
        return this.findById(id);
    }

    /**
     * Delete photo
     */
    static async delete(id: string): Promise<boolean> {
        const [result] = await pool.execute(
            'DELETE FROM photos WHERE id = ?',
            [id]
        ) as any;

        return result.affectedRows > 0;
    }

    /**
     * Check if user owns photo
     */
    static async isOwner(photoId: string, userId: string): Promise<boolean> {
        const [rows] = await pool.execute(
            'SELECT id FROM photos WHERE id = ? AND user_id = ?',
            [photoId, userId]
        );

        return (rows as any[]).length > 0;
    }

    /**
     * Check if photo is shared with user
     */
    static async isSharedWithUser(photoId: string, userId: string): Promise<boolean> {
        const [rows] = await pool.execute(
            'SELECT id FROM photo_shares WHERE photo_id = ? AND shared_with = ?',
            [photoId, userId]
        );

        return (rows as any[]).length > 0;
    }

    /**
     * Share photo with user
     */
    static async shareWithUser(photoId: string, sharedBy: string, sharedWith: string): Promise<boolean> {
        // Check if already shared
        const [existingShares] = await pool.execute(
            'SELECT id FROM photo_shares WHERE photo_id = ? AND shared_with = ?',
            [photoId, sharedWith]
        );

        if ((existingShares as any[]).length > 0) {
            return true; // Already shared
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
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';

export interface Comment {
    id: string;
    photo_id: string;
    user_id: string;
    content: string;
    created_at?: Date;
    username?: string;
}

export class CommentModel {
    /**
     * 创建新评论
     */
    static async create(comment: Omit<Comment, 'id' | 'created_at'>): Promise<Comment> {
        const id = uuidv4();

        await pool.execute(
            `INSERT INTO comments (id, photo_id, user_id, content)
             VALUES (?, ?, ?, ?)`,
            [id, comment.photo_id, comment.user_id, comment.content]
        );

        const createdComment = await this.findById(id);
        return createdComment as Comment;
    }

    /**
     * 通过ID查找评论
     */
    static async findById(id: string): Promise<Comment | null> {
        const [rows] = await pool.execute(
            `SELECT c.*, u.username
             FROM comments c
             LEFT JOIN users u ON c.user_id = u.id
             WHERE c.id = ?`,
            [id]
        );

        const comments = rows as Comment[];
        return comments.length > 0 ? comments[0] : null;
    }

    /**
     * 获取照片的所有评论
     */
    static async getByPhotoId(photoId: string, limit: number = 100): Promise<Comment[]> {
        // 确保limit是一个安全的数字
        const safeLimit = Math.min(Math.max(1, parseInt(String(limit)) || 100), 500);

        const [rows] = await pool.execute(
            `SELECT c.*, u.username
             FROM comments c
             LEFT JOIN users u ON c.user_id = u.id
             WHERE c.photo_id = ?
             ORDER BY c.created_at DESC
             LIMIT ${safeLimit}`,
            [photoId]
        );

        return rows as Comment[];
    }

    /**
     * 删除评论
     */
    static async delete(id: string): Promise<boolean> {
        const [result] = await pool.execute(
            'DELETE FROM comments WHERE id = ?',
            [id]
        ) as any;

        return result.affectedRows > 0;
    }
} 
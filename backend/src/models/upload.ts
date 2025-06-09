import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import pool from '../config/database';
import env from '../config/env';

export interface FileUpload {
    id: string;
    user_id: string;
    filename: string;
    original_filename: string;
    file_size: number;
    file_type: string;
    file_hash: string;
    chunks_total: number;
    chunks_uploaded: number;
    status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error';
    created_at?: Date;
    updated_at?: Date;
}

export interface FileChunk {
    id: string;
    upload_id: string;
    chunk_index: number;
    chunk_hash: string;
    chunk_size: number;
    created_at?: Date;
}

export interface UploadInit {
    user_id: string;
    original_filename: string;
    file_size: number;
    file_type: string;
    file_hash: string;
    chunks_total: number;
}

export class UploadModel {
    /**
     * 初始化新文件上传
     */
    static async initUpload(uploadData: UploadInit): Promise<FileUpload> {
        const { user_id, original_filename, file_size, file_type, file_hash, chunks_total } = uploadData;

        // 检查该用户是否已存在相同哈希值的上传
        const [existingUploads] = await pool.execute(
            'SELECT id, status FROM file_uploads WHERE user_id = ? AND file_hash = ?',
            [user_id, file_hash]
        );

        // 如果上传已存在且未完成，则返回它
        if ((existingUploads as any[]).length > 0) {
            const existingUpload = (existingUploads as any[])[0];
            if (existingUpload.status !== 'completed') {
                return existingUpload as FileUpload;
            }
        }

        // 生成唯一文件名
        const fileExt = path.extname(original_filename);
        const filename = `${file_hash}-${Date.now()}${fileExt}`;

        // 创建上传记录
        const id = uuidv4();
        await pool.execute(
            `INSERT INTO file_uploads (
        id, user_id, filename, original_filename, file_size, file_type, 
        file_hash, chunks_total, chunks_uploaded, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, user_id, filename, original_filename, file_size, file_type,
                file_hash, chunks_total, 0, 'pending'
            ]
        );

        // 如果上传目录不存在，则创建
        const uploadDir = path.join(env.UPLOAD_DIR, 'chunks', id);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        return {
            id,
            user_id,
            filename,
            original_filename,
            file_size,
            file_type,
            file_hash,
            chunks_total,
            chunks_uploaded: 0,
            status: 'pending'
        };
    }

    /**
     * 上传分块
     */
    static async uploadChunk(
        uploadId: string,
        chunkIndex: number,
        chunkHash: string,
        chunkBuffer: Buffer
    ): Promise<FileChunk> {
        // 获取上传记录
        const upload = await this.findById(uploadId);
        if (!upload) {
            throw new Error('Upload not found');
        }

        // 检查分块是否已存在
        const [existingChunks] = await pool.execute(
            'SELECT id FROM file_chunks WHERE upload_id = ? AND chunk_index = ?',
            [uploadId, chunkIndex]
        );

        if ((existingChunks as any[]).length > 0) {
            // 分块已存在，返回它
            return {
                id: (existingChunks as any[])[0].id,
                upload_id: uploadId,
                chunk_index: chunkIndex,
                chunk_hash: chunkHash,
                chunk_size: chunkBuffer.length
            };
        }

        // 将分块保存到磁盘
        const chunkDir = path.join(env.UPLOAD_DIR, 'chunks', uploadId);
        if (!fs.existsSync(chunkDir)) {
            fs.mkdirSync(chunkDir, { recursive: true });
        }

        const chunkPath = path.join(chunkDir, `${chunkIndex}`);
        fs.writeFileSync(chunkPath, chunkBuffer);

        // 创建分块记录
        const chunkId = uuidv4();
        await pool.execute(
            'INSERT INTO file_chunks (id, upload_id, chunk_index, chunk_hash, chunk_size) VALUES (?, ?, ?, ?, ?)',
            [chunkId, uploadId, chunkIndex, chunkHash, chunkBuffer.length]
        );

        // 更新上传状态
        await pool.execute(
            'UPDATE file_uploads SET chunks_uploaded = chunks_uploaded + 1, status = ? WHERE id = ?',
            ['uploading', uploadId]
        );

        // 检查是否所有分块都已上传
        const [result] = await pool.execute(
            'SELECT chunks_uploaded, chunks_total FROM file_uploads WHERE id = ?',
            [uploadId]
        );

        const uploadRecord = (result as any[])[0];
        if (uploadRecord.chunks_uploaded === uploadRecord.chunks_total) {
            // 所有分块已上传，更新状态
            await pool.execute(
                'UPDATE file_uploads SET status = ? WHERE id = ?',
                ['completed', uploadId]
            );
        }

        return {
            id: chunkId,
            upload_id: uploadId,
            chunk_index: chunkIndex,
            chunk_hash: chunkHash,
            chunk_size: chunkBuffer.length
        };
    }

    /**
     * 合并分块为最终文件
     */
    static async mergeChunks(uploadId: string): Promise<string> {
        // 获取上传记录
        const upload = await this.findById(uploadId);
        if (!upload) {
            throw new Error('Upload not found');
        }

        if (upload.status !== 'completed') {
            throw new Error('Upload not completed');
        }

        // 获取所有分块
        const [chunks] = await pool.execute(
            'SELECT chunk_index FROM file_chunks WHERE upload_id = ? ORDER BY chunk_index ASC',
            [uploadId]
        );

        if ((chunks as any[]).length !== upload.chunks_total) {
            throw new Error('Not all chunks are uploaded');
        }

        // 创建最终文件
        const finalFilePath = path.join(env.UPLOAD_DIR, upload.filename);
        const writeStream = fs.createWriteStream(finalFilePath);

        // 合并分块
        for (let i = 0; i < upload.chunks_total; i++) {
            const chunkPath = path.join(env.UPLOAD_DIR, 'chunks', uploadId, `${i}`);
            const chunkBuffer = fs.readFileSync(chunkPath);
            writeStream.write(chunkBuffer);
        }

        writeStream.end();

        // 等待文件写入完成
        await new Promise<void>((resolve) => {
            writeStream.on('finish', () => {
                resolve();
            });
        });

        // 清理分块
        const chunkDir = path.join(env.UPLOAD_DIR, 'chunks', uploadId);
        fs.rmSync(chunkDir, { recursive: true, force: true });

        return upload.filename;
    }

    /**
     * 通过ID查找上传
     */
    static async findById(id: string): Promise<FileUpload | null> {
        const [rows] = await pool.execute(
            'SELECT * FROM file_uploads WHERE id = ?',
            [id]
        );

        const uploads = rows as FileUpload[];
        return uploads.length > 0 ? uploads[0] : null;
    }

    /**
     * 通过用户ID查找上传
     */
    static async findByUserId(userId: string): Promise<FileUpload[]> {
        const [rows] = await pool.execute(
            'SELECT * FROM file_uploads WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

        return rows as FileUpload[];
    }

    /**
     * Update upload status
     */
    static async updateStatus(id: string, status: FileUpload['status']): Promise<boolean> {
        await pool.execute(
            'UPDATE file_uploads SET status = ? WHERE id = ?',
            [status, id]
        );

        return true;
    }

    /**
     * Delete upload
     */
    static async delete(id: string): Promise<boolean> {
        // Get upload record
        const upload = await this.findById(id);
        if (!upload) {
            return false;
        }

        // Delete chunks from disk
        const chunkDir = path.join(env.UPLOAD_DIR, 'chunks', id);
        if (fs.existsSync(chunkDir)) {
            fs.rmSync(chunkDir, { recursive: true, force: true });
        }

        // Delete final file if it exists
        const finalFilePath = path.join(env.UPLOAD_DIR, upload.filename);
        if (fs.existsSync(finalFilePath)) {
            fs.unlinkSync(finalFilePath);
        }

        // Delete from database
        await pool.execute('DELETE FROM file_chunks WHERE upload_id = ?', [id]);
        await pool.execute('DELETE FROM file_uploads WHERE id = ?', [id]);

        return true;
    }

    /**
     * Check upload progress
     */
    static async getProgress(id: string): Promise<{ uploadedChunks: number; totalChunks: number; progress: number }> {
        const [rows] = await pool.execute(
            'SELECT chunks_uploaded, chunks_total FROM file_uploads WHERE id = ?',
            [id]
        );

        if ((rows as any[]).length === 0) {
            throw new Error('Upload not found');
        }

        const upload = (rows as any[])[0];
        const progress = (upload.chunks_uploaded / upload.chunks_total) * 100;

        return {
            uploadedChunks: upload.chunks_uploaded,
            totalChunks: upload.chunks_total,
            progress
        };
    }

    /**
     * Check if user owns upload
     */
    static async isOwner(uploadId: string, userId: string): Promise<boolean> {
        const [rows] = await pool.execute(
            'SELECT id FROM file_uploads WHERE id = ? AND user_id = ?',
            [uploadId, userId]
        );

        return (rows as any[]).length > 0;
    }
} 
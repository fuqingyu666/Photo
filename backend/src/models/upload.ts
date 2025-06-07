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
     * Initialize a new file upload
     */
    static async initUpload(uploadData: UploadInit): Promise<FileUpload> {
        const { user_id, original_filename, file_size, file_type, file_hash, chunks_total } = uploadData;

        // Check if upload with same hash already exists for this user
        const [existingUploads] = await pool.execute(
            'SELECT id, status FROM file_uploads WHERE user_id = ? AND file_hash = ?',
            [user_id, file_hash]
        );

        // If upload exists and is not completed, return it
        if ((existingUploads as any[]).length > 0) {
            const existingUpload = (existingUploads as any[])[0];
            if (existingUpload.status !== 'completed') {
                return existingUpload as FileUpload;
            }
        }

        // Generate unique filename
        const fileExt = path.extname(original_filename);
        const filename = `${file_hash}-${Date.now()}${fileExt}`;

        // Create upload record
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

        // Create upload directory if it doesn't exist
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
     * Upload a chunk
     */
    static async uploadChunk(
        uploadId: string,
        chunkIndex: number,
        chunkHash: string,
        chunkBuffer: Buffer
    ): Promise<FileChunk> {
        // Get upload record
        const upload = await this.findById(uploadId);
        if (!upload) {
            throw new Error('Upload not found');
        }

        // Check if chunk already exists
        const [existingChunks] = await pool.execute(
            'SELECT id FROM file_chunks WHERE upload_id = ? AND chunk_index = ?',
            [uploadId, chunkIndex]
        );

        if ((existingChunks as any[]).length > 0) {
            // Chunk already exists, return it
            return {
                id: (existingChunks as any[])[0].id,
                upload_id: uploadId,
                chunk_index: chunkIndex,
                chunk_hash: chunkHash,
                chunk_size: chunkBuffer.length
            };
        }

        // Save chunk to disk
        const chunkDir = path.join(env.UPLOAD_DIR, 'chunks', uploadId);
        if (!fs.existsSync(chunkDir)) {
            fs.mkdirSync(chunkDir, { recursive: true });
        }

        const chunkPath = path.join(chunkDir, `${chunkIndex}`);
        fs.writeFileSync(chunkPath, chunkBuffer);

        // Create chunk record
        const chunkId = uuidv4();
        await pool.execute(
            'INSERT INTO file_chunks (id, upload_id, chunk_index, chunk_hash, chunk_size) VALUES (?, ?, ?, ?, ?)',
            [chunkId, uploadId, chunkIndex, chunkHash, chunkBuffer.length]
        );

        // Update upload status
        await pool.execute(
            'UPDATE file_uploads SET chunks_uploaded = chunks_uploaded + 1, status = ? WHERE id = ?',
            ['uploading', uploadId]
        );

        // Check if all chunks are uploaded
        const [result] = await pool.execute(
            'SELECT chunks_uploaded, chunks_total FROM file_uploads WHERE id = ?',
            [uploadId]
        );

        const uploadRecord = (result as any[])[0];
        if (uploadRecord.chunks_uploaded === uploadRecord.chunks_total) {
            // All chunks uploaded, update status
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
     * Merge chunks into final file
     */
    static async mergeChunks(uploadId: string): Promise<string> {
        // Get upload record
        const upload = await this.findById(uploadId);
        if (!upload) {
            throw new Error('Upload not found');
        }

        if (upload.status !== 'completed') {
            throw new Error('Upload not completed');
        }

        // Get all chunks
        const [chunks] = await pool.execute(
            'SELECT chunk_index FROM file_chunks WHERE upload_id = ? ORDER BY chunk_index ASC',
            [uploadId]
        );

        if ((chunks as any[]).length !== upload.chunks_total) {
            throw new Error('Not all chunks are uploaded');
        }

        // Create final file
        const finalFilePath = path.join(env.UPLOAD_DIR, upload.filename);
        const writeStream = fs.createWriteStream(finalFilePath);

        // Merge chunks
        for (let i = 0; i < upload.chunks_total; i++) {
            const chunkPath = path.join(env.UPLOAD_DIR, 'chunks', uploadId, `${i}`);
            const chunkBuffer = fs.readFileSync(chunkPath);
            writeStream.write(chunkBuffer);
        }

        writeStream.end();

        // Wait for file to be written
        await new Promise<void>((resolve) => {
            writeStream.on('finish', () => {
                resolve();
            });
        });

        // Clean up chunks
        const chunkDir = path.join(env.UPLOAD_DIR, 'chunks', uploadId);
        fs.rmSync(chunkDir, { recursive: true, force: true });

        return upload.filename;
    }

    /**
     * Find upload by ID
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
     * Find uploads by user ID
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
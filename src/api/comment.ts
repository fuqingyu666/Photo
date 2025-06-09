import axios from 'axios';
import { useAuthStore } from '../store/auth';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// 创建 Axios 实例
const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// 向请求添加认证令牌
api.interceptors.request.use(
    (config) => {
        const auth = useAuthStore();
        if (auth.token) {
            config.headers.Authorization = `Bearer ${auth.token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export interface Comment {
    id: string;
    photo_id: string;
    user_id: string;
    content: string;
    created_at: string;
    username?: string;
}

/**
 * 获取照片的评论
 */
export const getPhotoComments = async (photoId: string): Promise<Comment[]> => {
    try {
        const response = await api.get(`/api/comments/photo/${photoId}`);
        return response.data.comments || [];
    } catch (error) {
        console.error('Error getting comments:', error);
        return [];
    }
};

/**
 * 创建新评论
 */
export const createComment = async (photoId: string, content: string): Promise<Comment | null> => {
    try {
        const response = await api.post(`/api/comments/photo/${photoId}`, { content });
        return response.data.comment;
    } catch (error) {
        console.error('Error creating comment:', error);
        return null;
    }
};

/**
 * 删除评论
 */
export const deleteComment = async (photoId: string, commentId: string): Promise<boolean> => {
    try {
        await api.delete(`/api/comments/photo/${photoId}/comment/${commentId}`);
        return true;
    } catch (error) {
        console.error('Error deleting comment:', error);
        return false;
    }
}; 
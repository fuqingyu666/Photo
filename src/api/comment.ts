import axios from 'axios';
import { useAuthStore } from '../store/auth';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Create Axios instance
const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add auth token to requests
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
 * Get comments for a photo
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
 * Create a new comment
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
 * Delete a comment
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
import api from './index';

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
    url: string;
    created_at?: string;
    updated_at?: string;
    username?: string; // For shared photos
}

export interface PhotoCreate {
    title: string;
    description?: string;
    filename: string;
    original_filename: string;
    file_size: number;
    file_type: string;
    file_hash: string;
}

export interface PhotoUpdate {
    title?: string;
    description?: string;
}

export interface PhotosResponse {
    photos: Photo[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface PhotoResponse {
    photo: Photo;
    analysis?: any;
}

export interface ShareData {
    sharedWithUserId: string;
}

export interface UserSearchResult {
    id: string;
    username: string;
    email: string;
    avatar?: string;
}

/**
 * Get user photos with pagination
 */
export const getUserPhotos = async (page: number = 1, limit: number = 20): Promise<PhotosResponse> => {
    const response = await api.get<PhotosResponse>(`/photos?page=${page}&limit=${limit}`);
    return response.data;
};

/**
 * Get shared photos with pagination
 */
export const getSharedPhotos = async (page: number = 1, limit: number = 20): Promise<PhotosResponse> => {
    const response = await api.get<PhotosResponse>(`/photos/shared?page=${page}&limit=${limit}`);
    return response.data;
};

/**
 * Get a single photo by ID
 */
export const getPhotoById = async (id: string): Promise<PhotoResponse> => {
    const response = await api.get<PhotoResponse>(`/photos/${id}`);
    return response.data;
};

/**
 * Create a new photo
 */
export const createPhoto = async (data: PhotoCreate): Promise<Photo> => {
    const response = await api.post<{ photo: Photo }>('/photos', data);
    return response.data.photo;
};

/**
 * Update a photo
 */
export const updatePhoto = async (id: string, data: PhotoUpdate): Promise<Photo> => {
    const response = await api.put<{ photo: Photo }>(`/photos/${id}`, data);
    return response.data.photo;
};

/**
 * Delete a photo
 */
export const deletePhoto = async (id: string): Promise<void> => {
    await api.delete(`/photos/${id}`);
};

/**
 * Share a photo with another user
 */
export const sharePhoto = async (id: string, data: ShareData): Promise<void> => {
    await api.post(`/photos/${id}/share`, data);
};

/**
 * Unshare a photo with another user
 */
export const unsharePhoto = async (id: string, data: ShareData): Promise<void> => {
    await api.delete(`/photos/${id}/share`, { data });
};

/**
 * Get users who have access to a photo
 */
export const getPhotoShares = async (id: string): Promise<UserSearchResult[]> => {
    const response = await api.get<{ users: UserSearchResult[] }>(`/photos/${id}/shares`);
    return response.data.users;
};

/**
 * Search users for sharing
 */
export const searchUsers = async (query: string): Promise<UserSearchResult[]> => {
    if (!query || query.length < 2) {
        return [];
    }

    try {
        const response = await api.get<{ users: UserSearchResult[] }>(`/users/search?q=${encodeURIComponent(query)}`);
        return response.data.users;
    } catch (error) {
        console.error('Error searching users:', error);
        return [];
    }
}; 
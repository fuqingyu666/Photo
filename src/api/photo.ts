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
    username?: string; // 用于共享照片
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
    is_private?: boolean;
    is_shared?: boolean;
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
 * 获取用户照片（带分页）
 */
export const getUserPhotos = async (page: number = 1, limit: number = 20): Promise<PhotosResponse> => {
    const response = await api.get<PhotosResponse>(`/photos?page=${page}&limit=${limit}`);
    return response.data;
};

/**
 * 获取共享照片（带分页）
 */
export const getSharedPhotos = async (page: number = 1, limit: number = 20): Promise<PhotosResponse> => {
    const response = await api.get<PhotosResponse>(`/photos/shared?page=${page}&limit=${limit}&exclude_private=true`);
    return response.data;
};

/**
 * 通过ID获取单张照片
 */
export const getPhotoById = async (id: string): Promise<PhotoResponse> => {
    const response = await api.get<PhotoResponse>(`/photos/${id}`);
    return response.data;
};

/**
 * 创建新照片
 */
export const createPhoto = async (data: PhotoCreate): Promise<Photo> => {
    const response = await api.post<{ photo: Photo }>('/photos', data);
    return response.data.photo;
};

/**
 * 更新照片
 */
export const updatePhoto = async (id: string, data: PhotoUpdate): Promise<Photo> => {
    const response = await api.put<{ photo: Photo }>(`/photos/${id}`, data);
    return response.data.photo;
};

/**
 * 删除照片
 */
export const deletePhoto = async (id: string): Promise<void> => {
    await api.delete(`/photos/${id}`);
};

/**
 * 与其他用户共享照片
 */
export const sharePhoto = async (id: string, data: ShareData): Promise<void> => {
    await api.post(`/photos/${id}/share`, data);
};

/**
 * 取消与其他用户共享照片
 */
export const unsharePhoto = async (id: string, data: ShareData): Promise<void> => {
    await api.delete(`/photos/${id}/share`, { data });
};

/**
 * 获取有权访问照片的用户
 */
export const getPhotoShares = async (id: string): Promise<UserSearchResult[]> => {
    const response = await api.get<{ users: UserSearchResult[] }>(`/photos/${id}/shares`);
    return response.data.users;
};

/**
 * 搜索用户以进行共享
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

/**
 * 更新照片设置
 */
export const updatePhotoSettings = async (id: string, settings: {
    is_private?: boolean;
    is_shared?: boolean;
    title?: string;
    description?: string;
}): Promise<Photo> => {
    // 直接使用标准的更新端点
    const apiSettings: PhotoUpdate = {
        title: settings.title,
        description: settings.description,
        // 添加其他设置属性，采用与API兼容的格式
        is_private: settings.is_private,
        is_shared: settings.is_shared
    };

    console.log(`Updating photo ${id} with settings:`, apiSettings);
    const response = await api.put<{ photo: Photo }>(`/photos/${id}`, apiSettings);
    return response.data.photo;
}; 
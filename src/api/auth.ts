import api from './index';

export interface RegisterData {
    username: string;
    email: string;
    password: string;
}

export interface LoginData {
    email: string;
    password: string;
}

export interface User {
    id: string;
    username: string;
    email: string;
    avatar?: string;
}

export interface AuthResponse {
    user: User;
    token: string;
}

export interface ProfileUpdateData {
    username?: string;
    avatar?: string;
}

export interface PasswordChangeData {
    currentPassword: string;
    newPassword: string;
}

/**
 * Register a new user
 */
export const register = async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response.data;
};

/**
 * Login user
 */
export const login = async (data: LoginData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
};

/**
 * Get current user profile
 */
export const getProfile = async (): Promise<User> => {
    const response = await api.get<{ user: User }>('/auth/profile');
    return response.data.user;
};

/**
 * Update user profile
 */
export const updateProfile = async (data: ProfileUpdateData): Promise<User> => {
    const response = await api.put<{ user: User }>('/auth/profile', data);
    return response.data.user;
};

/**
 * Change password
 */
export const changePassword = async (data: PasswordChangeData): Promise<void> => {
    await api.post('/auth/change-password', data);
}; 
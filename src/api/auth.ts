import api from './index';

/**
 * 注册数据接口
 * 定义用户注册时需要提供的字段
 */
export interface RegisterData {
    username: string;   // 用户名
    email: string;      // 电子邮件
    password: string;   // 密码
}

/**
 * 登录数据接口
 * 定义用户登录时需要提供的字段
 */
export interface LoginData {
    email: string;      // 电子邮件
    password: string;   // 密码
}

/**
 * 用户信息接口
 * 定义用户基本信息的结构
 */
export interface User {
    id: string;         // 用户唯一标识
    username: string;   // 用户名
    email: string;      // 电子邮件
    avatar?: string;    // 头像URL（可选）
}

/**
 * 认证响应接口
 * 定义登录或注册成功后服务器返回的数据结构
 */
export interface AuthResponse {
    user: User;         // 用户信息
    token: string;      // 认证令牌（JWT token）
}

/**
 * 个人资料更新数据接口
 * 定义用户可以更新的个人资料字段
 */
export interface ProfileUpdateData {
    username?: string;  // 更新的用户名（可选）
    avatar?: string;    // 更新的头像URL（可选）
}

/**
 * 密码修改数据接口
 * 定义用户修改密码时需要提供的字段
 */
export interface PasswordChangeData {
    currentPassword: string;  // 当前密码
    newPassword: string;      // 新密码
}

/**
 * 注册新用户
 * 向服务器发送注册请求，创建新用户账号
 * 
 * @param data 包含用户名、邮箱和密码的注册数据
 * @returns 包含用户信息和认证令牌的响应
 */
export const register = async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response.data;
};

/**
 * 用户登录
 * 向服务器发送登录请求，获取认证令牌
 * 
 * @param data 包含邮箱和密码的登录数据
 * @returns 包含用户信息和认证令牌的响应
 */
export const login = async (data: LoginData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
};

/**
 * 获取当前用户资料
 * 使用已存储的令牌向服务器请求当前登录用户的详细信息
 * 
 * @returns 当前用户的信息
 */
export const getProfile = async (): Promise<User> => {
    const response = await api.get<{ user: User }>('/auth/profile');
    return response.data.user;
};

/**
 * 更新用户个人资料
 * 向服务器发送请求以更新当前用户的资料信息
 * 
 * @param data 要更新的用户资料字段
 * @returns 更新后的用户信息
 */
export const updateProfile = async (data: ProfileUpdateData): Promise<User> => {
    const response = await api.put<{ user: User }>('/auth/profile', data);
    return response.data.user;
};

/**
 * 修改密码
 * 向服务器发送请求以更改当前用户的密码
 * 
 * @param data 包含当前密码和新密码的数据
 */
export const changePassword = async (data: PasswordChangeData): Promise<void> => {
    await api.post('/auth/change-password', data);
}; 
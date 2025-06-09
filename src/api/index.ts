import axios from 'axios';

/**
 * 创建axios实例
 * 这个实例是所有API请求的基础，配置了基本URL和默认请求头
 * axios是一个流行的HTTP客户端库，简化了API调用过程
 */
const api = axios.create({
    // 基本URL从环境变量获取，如果未设置则使用本地开发地址
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
    // 设置默认请求头为JSON格式
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * 添加请求拦截器
 * 拦截器会在每个请求发送前执行，用于添加认证令牌（token）
 * 这确保了已登录用户的所有请求都带有正确的认证信息
 */
api.interceptors.request.use(
    (config) => {
        // 从本地存储获取认证令牌
        const token = localStorage.getItem('token');
        // 如果令牌存在，添加到请求头的Authorization字段
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    // 如果请求配置出错，返回Promise.reject
    (error) => Promise.reject(error)
);

/**
 * 添加响应拦截器
 * 响应拦截器会在收到服务器响应后执行
 * 主要用于统一处理错误，特别是认证失败的情况
 */
api.interceptors.response.use(
    // 成功响应直接返回
    (response) => response,
    (error) => {
        // 处理401未授权错误（通常意味着登录已过期或无效）
        if (error.response && error.response.status === 401) {
            // 清除本地存储中的用户信息和令牌
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // 重定向到登录页面，强制用户重新登录
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// 导出配置好的api实例，供其他模块使用
export default api; 
import axios from 'axios';
import { useAuthStore } from '../store/auth';

// 添加请求拦截器
axios.interceptors.request.use(
    config => {
        // 记录请求信息
        console.log(`请求: ${config.method?.toUpperCase()} ${config.url}`);
        console.log('请求头:', config.headers);
        return config;
    },
    error => {
        console.error('请求拦截器错误:', error);
        return Promise.reject(error);
    }
);

// 添加响应拦截器
axios.interceptors.response.use(
    response => {
        console.log(`响应: ${response.status} ${response.config.url}`);
        return response;
    },
    error => {
        console.error('响应错误:', error);
        if (error.response) {
            console.error('错误状态码:', error.response.status);
            console.error('错误数据:', error.response.data);
        }
        return Promise.reject(error);
    }
);

// 上传文件
export const initUpload = async (formData: FormData) => {
    const auth = useAuthStore();
    try {
        console.log('开始上传文件...');
        console.log('使用的认证Token:', auth.token);

        const response = await axios.post('/api/upload/init', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                'Authorization': `Bearer ${auth.token}`
            }
        });

        return response.data;
    } catch (error) {
        console.error('上传失败:', error);
        throw error;
    }
};

// 上传文件块
export const uploadChunk = async (fileId: string, chunk: Blob, index: number) => {
    const auth = useAuthStore();
    try {
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('chunk_index', index.toString());
        formData.append('chunk_hash', `${fileId}-${index}`);

        // 打印调试信息
        console.log(`上传分块 ${index}/${fileId}`);

        const response = await axios.post(`/api/upload/chunk/${fileId}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                'Authorization': `Bearer ${auth.token}`
            }
        });

        return response.data;
    } catch (error) {
        console.error('上传分块失败:', error);
        throw error;
    }
};

// 完成上传
export const completeUpload = async (fileId: string, filename: string, totalChunks: number) => {
    const auth = useAuthStore();
    try {
        const response = await axios.post('/api/upload/complete', {
            upload_id: fileId,
            filename,
            totalChunks
        }, {
            headers: {
                'Authorization': `Bearer ${auth.token}`
            }
        });

        return response.data;
    } catch (error) {
        console.error('完成上传失败:', error);
        throw error;
    }
}; 
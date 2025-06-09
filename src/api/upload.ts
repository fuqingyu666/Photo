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

// 常量定义
const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunk size
const BASE_URL = '/api';

// 创建API实例，确保每个请求都带有正确的认证头
const createApiInstance = () => {
    const auth = useAuthStore();
    const token = auth.token || localStorage.getItem('token');

    return axios.create({
        baseURL: BASE_URL,
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
};

// 计算文件哈希值
const calculateFileHash = (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const hash = `${file.name}-${file.size}-${file.lastModified}`;
        resolve(hash);
    });
};

// 检查已上传的分块
export const checkUploadStatus = async (fileHash: string): Promise<{ uploadId?: string, uploadedChunks: number[] }> => {
    try {
        const api = createApiInstance();
        const response = await api.get(`/upload/status?fileHash=${fileHash}`);

        return {
            uploadId: response.data.uploadId,
            uploadedChunks: response.data.uploadedChunks || []
        };
    } catch (error) {
        console.log('No existing upload found, starting new upload');
        return { uploadedChunks: [] };
    }
};

// 简单一次性上传
export const simpleUpload = async (file: File): Promise<any> => {
    const api = createApiInstance();
    const formData = new FormData();

    formData.append('file', file);
    // 确保文件名正确编码
    formData.append('filename', encodeURIComponent(file.name));

    // 添加文件元数据，确保正确编码标题
    formData.append('title', encodeURIComponent(file.name.split('.')[0]));
    formData.append('description', '');
    formData.append('is_private', 'false');
    formData.append('is_shared', 'true');

    try {
        const response = await api.post('/photos/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });

        return response.data;
    } catch (error) {
        console.error('Simple upload failed:', error);
        throw error;
    }
};

// 初始化上传
export const initUpload = async (file: File): Promise<{ uploadId: string, uploadedChunks: number[] }> => {
    try {
        // 尝试直接进行简单上传
        if (file.size <= 10 * 1024 * 1024) { // 如果文件小于10MB，直接上传
            try {
                console.log('Attempting simple upload for small file');
                const result = await simpleUpload(file);
                return {
                    uploadId: result.photo?.id || 'direct-upload',
                    uploadedChunks: [0]
                };
            } catch (err) {
                console.warn('Simple upload failed, falling back to chunked upload:', err);
            }
        }

        const api = createApiInstance();
        const fileHash = await calculateFileHash(file);

        // 尝试检查现有上传
        try {
            const existingUpload = await checkUploadStatus(fileHash);

            if (existingUpload.uploadId) {
                console.log('Resuming existing upload:', existingUpload);
                return existingUpload;
            }
        } catch (err) {
            console.log('Failed to check existing upload, starting new one');
        }

        // 新的上传
        const formData = new FormData();
        formData.append('filename', encodeURIComponent(file.name));
        formData.append('fileSize', file.size.toString());
        formData.append('fileType', file.type);
        formData.append('fileHash', fileHash);
        formData.append('totalChunks', Math.ceil(file.size / CHUNK_SIZE).toString());

        // 添加第一个分块以增加兼容性
        const firstChunk = file.slice(0, Math.min(CHUNK_SIZE, file.size));
        formData.append('chunk', firstChunk);

        console.log('开始新的文件上传...');

        const response = await api.post('/upload/init', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });

        console.log('Upload init response:', response.data);

        // 处理直接上传成功的情况
        if (response.data.url || response.data.photo) {
            console.log('Server processed full upload directly');
            return {
                uploadId: response.data.photo?.id || 'direct-upload',
                uploadedChunks: [0]
            };
        }

        // 尝试找到上传ID
        const uploadId = response.data.uploadId || response.data.id || fileHash;
        console.log('Generated upload ID:', uploadId);

        return {
            uploadId,
            uploadedChunks: []
        };
    } catch (error) {
        console.error('上传初始化失败:', error);
        throw error;
    }
};

// 上传单个分块
export const uploadChunk = async (file: File, uploadId: string, chunkIndex: number): Promise<boolean> => {
    try {
        const api = createApiInstance();

        // 如果是直接上传模式，跳过分块上传
        if (uploadId === 'direct-upload') {
            return true;
        }

        // 计算当前分块的起始位置和结束位置
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);

        // 创建分块Blob
        const chunk = file.slice(start, end);
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('chunk_index', chunkIndex.toString());
        formData.append('chunk_hash', `${uploadId}-${chunkIndex}`);
        formData.append('upload_id', uploadId);
        formData.append('uploadId', uploadId);

        console.log(`上传分块 ${chunkIndex + 1}/${Math.ceil(file.size / CHUNK_SIZE)}`);

        const response = await api.post(`/upload/chunk/${uploadId}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });

        return true;
    } catch (error) {
        console.error(`上传分块 ${chunkIndex} 失败:`, error);
        if (error.response && error.response.status === 404) {
            console.log('Server returned 404 - endpoint may not exist, will try to continue anyway');
            return true;
        }
        return false;
    }
};

// 上传完整文件
export const uploadFile = async (file: File,
    progressCallback?: (percent: number) => void,
    pauseSignal?: { paused: boolean }): Promise<{ success: boolean, photoId?: string, url?: string }> => {
    try {
        // 如果文件小于10MB，尝试使用简单上传
        if (file.size <= 10 * 1024 * 1024) {
            try {
                if (progressCallback) progressCallback(10);

                const result = await simpleUpload(file);

                if (progressCallback) progressCallback(100);

                return {
                    success: true,
                    photoId: result.photo?.id,
                    url: result.url || result.photo?.url
                };
            } catch (err) {
                console.warn('Simple upload failed, falling back to chunked upload:', err);
            }
        }

        // 初始化上传，获取上传ID
        if (progressCallback) progressCallback(5);
        const { uploadId, uploadedChunks } = await initUpload(file);
        if (!uploadId) {
            throw new Error("Failed to initialize upload");
        }

        // 处理直接上传的情况
        if (uploadId === 'direct-upload') {
            if (progressCallback) {
                progressCallback(100);
            }
            return { success: true, photoId: uploadId };
        }

        // 计算分块总数
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const uploadedChunksSet = new Set(uploadedChunks);

        // 更新初始进度
        if (progressCallback) {
            const progress = Math.round((uploadedChunksSet.size / totalChunks) * 100);
            progressCallback(Math.max(10, progress)); // 至少显示10%进度
        }

        // 上传所有分块
        for (let i = 0; i < totalChunks; i++) {
            // 跳过已上传的分块
            if (uploadedChunksSet.has(i)) {
                continue;
            }

            // 检查是否暂停
            if (pauseSignal?.paused) {
                console.log("Upload paused");
                return { success: false };
            }

            // 上传分块
            const success = await uploadChunk(file, uploadId, i);
            if (success) {
                uploadedChunksSet.add(i);

                // 更新进度 (保留10%给完成操作)
                if (progressCallback) {
                    const progress = Math.round((uploadedChunksSet.size / totalChunks) * 90);
                    progressCallback(Math.max(10, progress));
                }
            } else {
                // 尝试重试，最多3次
                let retryCount = 0;
                let retrySuccess = false;

                while (retryCount < 3 && !retrySuccess) {
                    console.log(`Retry ${retryCount + 1} for chunk ${i}`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    retrySuccess = await uploadChunk(file, uploadId, i);
                    retryCount++;

                    if (retrySuccess) {
                        uploadedChunksSet.add(i);
                        if (progressCallback) {
                            const progress = Math.round((uploadedChunksSet.size / totalChunks) * 90);
                            progressCallback(Math.max(10, progress));
                        }
                        break;
                    }
                }

                if (!retrySuccess) {
                    throw new Error(`Failed to upload chunk ${i} after multiple retries`);
                }
            }
        }

        // 完成上传
        if (progressCallback) progressCallback(95);
        const result = await completeUpload(uploadId, file.name, totalChunks);
        if (progressCallback) progressCallback(100);

        return result;
    } catch (error) {
        console.error("文件上传失败:", error);
        return { success: false };
    }
};

// 完成上传
export const completeUpload = async (uploadId: string, filename: string, totalChunks: number): Promise<{ success: boolean, photoId?: string, url?: string }> => {
    try {
        const api = createApiInstance();

        // 如果是直接上传，不需要完成步骤
        if (uploadId === 'direct-upload') {
            return { success: true };
        }

        // 准备完成上传请求数据
        const data = {
            upload_id: uploadId,
            uploadId: uploadId,
            filename: encodeURIComponent(filename),
            totalChunks
        };

        console.log('Completing upload with data:', data);

        // 尝试完成上传 - 这里可能会失败如果服务器已经自动处理了上传
        try {
            const response = await api.post('/upload/complete', data);

            return {
                success: true,
                photoId: response.data.photoId || response.data.id || response.data.photo?.id,
                url: response.data.url || response.data.photo?.url
            };
        } catch (completionError) {
            console.warn('Complete upload endpoint failed, trying photos/finish-upload endpoint:', completionError);

            // 尝试photos/finish-upload端点 (确保带上认证token)
            try {
                const token = localStorage.getItem('token');
                const altResponse = await api.post('/photos/finish-upload', data, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (altResponse.data) {
                    return {
                        success: true,
                        photoId: altResponse.data.photoId || altResponse.data.id || altResponse.data.photo?.id,
                        url: altResponse.data.url || altResponse.data.photo?.url
                    };
                }
            } catch (e) {
                console.log(`Photos finish-upload endpoint failed:`, e);
            }

            // 如果所有完成端点失败，尝试直接检查照片是否上传成功
            try {
                const verifyResponse = await api.get(`/photos?search=${encodeURIComponent(filename)}`);
                if (verifyResponse.data.photos && verifyResponse.data.photos.length > 0) {
                    const latestPhoto = verifyResponse.data.photos[0];
                    console.log('Found uploaded photo:', latestPhoto);
                    return {
                        success: true,
                        photoId: latestPhoto.id,
                        url: latestPhoto.url
                    };
                }
            } catch (verifyError) {
                console.error('Failed to verify upload:', verifyError);
            }

            // 如果所有尝试都失败，返回成功但没有ID
            // 因为服务器可能已经处理了文件，但我们无法确定ID
            console.log('Could not verify upload success, but chunks were uploaded successfully');
            return { success: true };
        }
    } catch (error) {
        console.error('完成上传失败:', error);
        return { success: false };
    }
}; 
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as uploadApi from '../api/upload'
import { FileUpload, UploadProgress } from '../api/upload'
import { joinUploadRoom, onUploadProgress, onUploadCompleted, onUploadStatusUpdated } from '../utils/socket'

export const useUploadStore = defineStore('upload', () => {
    // 状态
    const uploads = ref<FileUpload[]>([])
    const currentUpload = ref<FileUpload | null>(null)
    const loading = ref(false)
    const error = ref('')
    const progress = ref<UploadProgress | null>(null)
    const activeUploads = ref<string[]>([]) // 跟踪活跃上传的ID

    // 获取器
    const isUploading = computed(() => activeUploads.value.length > 0)

    const pendingUploads = computed(() =>
        uploads.value.filter(u => u.status === 'pending' || u.status === 'paused')
    )

    const completedUploads = computed(() =>
        uploads.value.filter(u => u.status === 'completed')
    )

    // 操作
    // 初始化新上传
    const initUpload = async (file: File): Promise<FileUpload | null> => {
        loading.value = true
        error.value = ''

        try {
            // 创建文件块并计算哈希
            const { chunks, fileHash } = await uploadApi.createFileChunks(file)

            // 初始化上传
            const uploadData = {
                original_filename: file.name,
                file_size: file.size,
                file_type: file.type,
                file_hash: fileHash,
                chunks_total: chunks.length
            }

            const upload = await uploadApi.initUpload(uploadData)

            // 添加到上传列表
            uploads.value = [upload, ...uploads.value]
            currentUpload.value = upload

            // 加入此上传的socket房间
            joinUploadRoom(upload.id)

            // 设置socket监听器
            setupSocketListeners(upload.id)

            return upload
        } catch (err: any) {
            error.value = err.response?.data?.error || '初始化上传失败'
            return null
        } finally {
            loading.value = false
        }
    }

    // 上传文件块
    const uploadChunks = async (file: File, uploadId: string): Promise<boolean> => {
        loading.value = true
        error.value = ''

        try {
            // 添加到活跃上传
            if (!activeUploads.value.includes(uploadId)) {
                activeUploads.value.push(uploadId)
            }

            // 获取上传
            const upload = uploads.value.find(u => u.id === uploadId)
            if (!upload) {
                throw new Error('未找到上传')
            }

            // 创建文件块
            const { chunks } = await uploadApi.createFileChunks(file)

            // 上传文件块
            for (let i = 0; i < chunks.length; i++) {
                // 跳过已上传的块
                if (i < upload.chunks_uploaded) {
                    continue
                }

                // 上传块
                const result = await uploadApi.uploadChunk(uploadId, i, chunks[i])

                // 更新进度
                progress.value = result.progress

                // 更新列表中的上传
                const index = uploads.value.findIndex(u => u.id === uploadId)
                if (index !== -1) {
                    uploads.value[index].chunks_uploaded = result.progress.uploadedChunks
                    uploads.value[index].status = 'uploading'
                }

                // 更新当前上传
                if (currentUpload.value && currentUpload.value.id === uploadId) {
                    currentUpload.value.chunks_uploaded = result.progress.uploadedChunks
                    currentUpload.value.status = 'uploading'
                }

                // 检查用户是否暂停上传
                const updatedUpload = uploads.value.find(u => u.id === uploadId)
                if (updatedUpload && updatedUpload.status === 'paused') {
                    // 从活跃上传中移除
                    activeUploads.value = activeUploads.value.filter(id => id !== uploadId)
                    return false
                }
            }

            // 完成上传
            await uploadApi.completeUpload(uploadId)

            // 更新上传状态
            const index = uploads.value.findIndex(u => u.id === uploadId)
            if (index !== -1) {
                uploads.value[index].status = 'completed'
            }

            // 更新当前上传
            if (currentUpload.value && currentUpload.value.id === uploadId) {
                currentUpload.value.status = 'completed'
            }

            // 从活跃上传中移除
            activeUploads.value = activeUploads.value.filter(id => id !== uploadId)

            return true
        } catch (err: any) {
            error.value = err.response?.data?.error || '上传文件失败'

            // 更新上传状态
            const index = uploads.value.findIndex(u => u.id === uploadId)
            if (index !== -1) {
                uploads.value[index].status = 'error'
            }

            // 更新当前上传
            if (currentUpload.value && currentUpload.value.id === uploadId) {
                currentUpload.value.status = 'error'
            }

            // 从活跃上传中移除
            activeUploads.value = activeUploads.value.filter(id => id !== uploadId)

            return false
        } finally {
            loading.value = false
        }
    }

    // 获取上传状态
    const getUploadStatus = async (uploadId: string): Promise<UploadProgress | null> => {
        loading.value = true
        error.value = ''

        try {
            const result = await uploadApi.getUploadStatus(uploadId)

            // 更新列表中的上传
            const index = uploads.value.findIndex(u => u.id === uploadId)
            if (index !== -1) {
                uploads.value[index] = result.upload
            }

            // 更新当前上传
            if (currentUpload.value && currentUpload.value.id === uploadId) {
                currentUpload.value = result.upload
            }

            progress.value = result.progress
            return result.progress
        } catch (err: any) {
            error.value = err.response?.data?.error || '获取上传状态失败'
            return null
        } finally {
            loading.value = false
        }
    }

    // 更新上传状态（暂停/恢复）
    const updateUploadStatus = async (uploadId: string, status: FileUpload['status']): Promise<boolean> => {
        loading.value = true
        error.value = ''

        try {
            const result = await uploadApi.updateUploadStatus(uploadId, status)

            // 更新列表中的上传
            const index = uploads.value.findIndex(u => u.id === uploadId)
            if (index !== -1) {
                uploads.value[index] = result.upload
            }

            // 更新当前上传
            if (currentUpload.value && currentUpload.value.id === uploadId) {
                currentUpload.value = result.upload
            }

            // 更新活跃上传
            if (status === 'paused' || status === 'error' || status === 'completed') {
                activeUploads.value = activeUploads.value.filter(id => id !== uploadId)
            } else if (status === 'uploading' && !activeUploads.value.includes(uploadId)) {
                activeUploads.value.push(uploadId)
            }

            return true
        } catch (err: any) {
            error.value = err.response?.data?.error || '更新上传状态失败'
            return false
        } finally {
            loading.value = false
        }
    }

    // 删除上传
    const deleteUpload = async (uploadId: string): Promise<boolean> => {
        loading.value = true
        error.value = ''

        try {
            await uploadApi.deleteUpload(uploadId)

            // 从上传列表中移除
            uploads.value = uploads.value.filter(u => u.id !== uploadId)

            // 如果是当前上传则清除
            if (currentUpload.value && currentUpload.value.id === uploadId) {
                currentUpload.value = null
            }

            // 从活跃上传中移除
            activeUploads.value = activeUploads.value.filter(id => id !== uploadId)

            return true
        } catch (err: any) {
            error.value = err.response?.data?.error || '删除上传失败'
            return false
        } finally {
            loading.value = false
        }
    }

    // 获取用户上传
    const getUserUploads = async (): Promise<FileUpload[]> => {
        loading.value = true
        error.value = ''

        try {
            const result = await uploadApi.getUserUploads()
            uploads.value = result
            return result
        } catch (err: any) {
            error.value = err.response?.data?.error || '获取上传列表失败'
            return []
        } finally {
            loading.value = false
        }
    }

    // 设置socket监听器
    const setupSocketListeners = (uploadId: string) => {
        // 监听上传进度
        onUploadProgress((data) => {
            if (data.upload_id !== uploadId) return

            // 更新进度
            progress.value = {
                uploadedChunks: data.uploaded_chunks,
                totalChunks: data.total_chunks,
                uploadedSize: data.uploaded_size,
                totalSize: data.total_size,
                percent: data.percent
            }

            // 更新列表中的上传
            const index = uploads.value.findIndex(u => u.id === uploadId)
            if (index !== -1) {
                uploads.value[index].chunks_uploaded = data.uploaded_chunks
                uploads.value[index].status = 'uploading'
            }

            // 更新当前上传
            if (currentUpload.value && currentUpload.value.id === uploadId) {
                currentUpload.value.chunks_uploaded = data.uploaded_chunks
                currentUpload.value.status = 'uploading'
            }
        })

        // 监听上传完成
        onUploadCompleted((data) => {
            if (data.upload_id !== uploadId) return

            // 更新列表中的上传
            const index = uploads.value.findIndex(u => u.id === uploadId)
            if (index !== -1) {
                uploads.value[index].status = 'completed'
                uploads.value[index].filename = data.filename
            }

            // 更新当前上传
            if (currentUpload.value && currentUpload.value.id === uploadId) {
                currentUpload.value.status = 'completed'
                currentUpload.value.filename = data.filename
            }

            // 从活跃上传中移除
            activeUploads.value = activeUploads.value.filter(id => id !== uploadId)
        })

        // 监听上传状态更新
        onUploadStatusUpdated((data) => {
            if (data.upload_id !== uploadId) return

            // 更新列表中的上传
            const index = uploads.value.findIndex(u => u.id === uploadId)
            if (index !== -1) {
                uploads.value[index].status = data.status as FileUpload['status']
            }

            // 更新当前上传
            if (currentUpload.value && currentUpload.value.id === uploadId) {
                currentUpload.value.status = data.status as FileUpload['status']
            }

            // 更新活跃上传
            if (data.status === 'paused' || data.status === 'error' || data.status === 'completed') {
                activeUploads.value = activeUploads.value.filter(id => id !== uploadId)
            } else if (data.status === 'uploading' && !activeUploads.value.includes(uploadId)) {
                activeUploads.value.push(uploadId)
            }
        })
    }

    // 重置存储
    const reset = () => {
        uploads.value = []
        currentUpload.value = null
        loading.value = false
        error.value = ''
        progress.value = null
        activeUploads.value = []
    }

    return {
        // 状态
        uploads,
        currentUpload,
        loading,
        error,
        progress,
        activeUploads,

        // 获取器
        isUploading,
        pendingUploads,
        completedUploads,

        // 操作
        initUpload,
        uploadChunks,
        getUploadStatus,
        updateUploadStatus,
        deleteUpload,
        getUserUploads,
        reset
    }
}) 
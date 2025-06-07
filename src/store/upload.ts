import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as uploadApi from '../api/upload'
import { FileUpload, UploadProgress } from '../api/upload'
import { joinUploadRoom, onUploadProgress, onUploadCompleted, onUploadStatusUpdated } from '../utils/socket'

export const useUploadStore = defineStore('upload', () => {
    // State
    const uploads = ref<FileUpload[]>([])
    const currentUpload = ref<FileUpload | null>(null)
    const loading = ref(false)
    const error = ref('')
    const progress = ref<UploadProgress | null>(null)
    const activeUploads = ref<string[]>([]) // Track active upload IDs

    // Getters
    const isUploading = computed(() => activeUploads.value.length > 0)

    const pendingUploads = computed(() =>
        uploads.value.filter(u => u.status === 'pending' || u.status === 'paused')
    )

    const completedUploads = computed(() =>
        uploads.value.filter(u => u.status === 'completed')
    )

    // Actions
    // Initialize a new upload
    const initUpload = async (file: File): Promise<FileUpload | null> => {
        loading.value = true
        error.value = ''

        try {
            // Create file chunks and calculate hash
            const { chunks, fileHash } = await uploadApi.createFileChunks(file)

            // Initialize upload
            const uploadData = {
                original_filename: file.name,
                file_size: file.size,
                file_type: file.type,
                file_hash: fileHash,
                chunks_total: chunks.length
            }

            const upload = await uploadApi.initUpload(uploadData)

            // Add to uploads list
            uploads.value = [upload, ...uploads.value]
            currentUpload.value = upload

            // Join socket room for this upload
            joinUploadRoom(upload.id)

            // Set up socket listeners
            setupSocketListeners(upload.id)

            return upload
        } catch (err: any) {
            error.value = err.response?.data?.error || 'Failed to initialize upload'
            return null
        } finally {
            loading.value = false
        }
    }

    // Upload file chunks
    const uploadChunks = async (file: File, uploadId: string): Promise<boolean> => {
        loading.value = true
        error.value = ''

        try {
            // Add to active uploads
            if (!activeUploads.value.includes(uploadId)) {
                activeUploads.value.push(uploadId)
            }

            // Get upload
            const upload = uploads.value.find(u => u.id === uploadId)
            if (!upload) {
                throw new Error('Upload not found')
            }

            // Create file chunks
            const { chunks } = await uploadApi.createFileChunks(file)

            // Upload chunks
            for (let i = 0; i < chunks.length; i++) {
                // Skip already uploaded chunks
                if (i < upload.chunks_uploaded) {
                    continue
                }

                // Upload chunk
                const result = await uploadApi.uploadChunk(uploadId, i, chunks[i])

                // Update progress
                progress.value = result.progress

                // Update upload in list
                const index = uploads.value.findIndex(u => u.id === uploadId)
                if (index !== -1) {
                    uploads.value[index].chunks_uploaded = result.progress.uploadedChunks
                    uploads.value[index].status = 'uploading'
                }

                // Update current upload
                if (currentUpload.value && currentUpload.value.id === uploadId) {
                    currentUpload.value.chunks_uploaded = result.progress.uploadedChunks
                    currentUpload.value.status = 'uploading'
                }

                // Check if user paused the upload
                const updatedUpload = uploads.value.find(u => u.id === uploadId)
                if (updatedUpload && updatedUpload.status === 'paused') {
                    // Remove from active uploads
                    activeUploads.value = activeUploads.value.filter(id => id !== uploadId)
                    return false
                }
            }

            // Complete upload
            await uploadApi.completeUpload(uploadId)

            // Update upload status
            const index = uploads.value.findIndex(u => u.id === uploadId)
            if (index !== -1) {
                uploads.value[index].status = 'completed'
            }

            // Update current upload
            if (currentUpload.value && currentUpload.value.id === uploadId) {
                currentUpload.value.status = 'completed'
            }

            // Remove from active uploads
            activeUploads.value = activeUploads.value.filter(id => id !== uploadId)

            return true
        } catch (err: any) {
            error.value = err.response?.data?.error || 'Failed to upload file'

            // Update upload status
            const index = uploads.value.findIndex(u => u.id === uploadId)
            if (index !== -1) {
                uploads.value[index].status = 'error'
            }

            // Update current upload
            if (currentUpload.value && currentUpload.value.id === uploadId) {
                currentUpload.value.status = 'error'
            }

            // Remove from active uploads
            activeUploads.value = activeUploads.value.filter(id => id !== uploadId)

            return false
        } finally {
            loading.value = false
        }
    }

    // Get upload status
    const getUploadStatus = async (uploadId: string): Promise<UploadProgress | null> => {
        loading.value = true
        error.value = ''

        try {
            const result = await uploadApi.getUploadStatus(uploadId)

            // Update upload in list
            const index = uploads.value.findIndex(u => u.id === uploadId)
            if (index !== -1) {
                uploads.value[index] = result.upload
            }

            // Update current upload
            if (currentUpload.value && currentUpload.value.id === uploadId) {
                currentUpload.value = result.upload
            }

            progress.value = result.progress
            return result.progress
        } catch (err: any) {
            error.value = err.response?.data?.error || 'Failed to get upload status'
            return null
        } finally {
            loading.value = false
        }
    }

    // Update upload status (pause/resume)
    const updateUploadStatus = async (uploadId: string, status: FileUpload['status']): Promise<boolean> => {
        loading.value = true
        error.value = ''

        try {
            const result = await uploadApi.updateUploadStatus(uploadId, status)

            // Update upload in list
            const index = uploads.value.findIndex(u => u.id === uploadId)
            if (index !== -1) {
                uploads.value[index] = result.upload
            }

            // Update current upload
            if (currentUpload.value && currentUpload.value.id === uploadId) {
                currentUpload.value = result.upload
            }

            // Update active uploads
            if (status === 'paused' || status === 'error' || status === 'completed') {
                activeUploads.value = activeUploads.value.filter(id => id !== uploadId)
            } else if (status === 'uploading' && !activeUploads.value.includes(uploadId)) {
                activeUploads.value.push(uploadId)
            }

            return true
        } catch (err: any) {
            error.value = err.response?.data?.error || 'Failed to update upload status'
            return false
        } finally {
            loading.value = false
        }
    }

    // Delete upload
    const deleteUpload = async (uploadId: string): Promise<boolean> => {
        loading.value = true
        error.value = ''

        try {
            await uploadApi.deleteUpload(uploadId)

            // Remove from uploads list
            uploads.value = uploads.value.filter(u => u.id !== uploadId)

            // Clear current upload if it's the same
            if (currentUpload.value && currentUpload.value.id === uploadId) {
                currentUpload.value = null
            }

            // Remove from active uploads
            activeUploads.value = activeUploads.value.filter(id => id !== uploadId)

            return true
        } catch (err: any) {
            error.value = err.response?.data?.error || 'Failed to delete upload'
            return false
        } finally {
            loading.value = false
        }
    }

    // Get user uploads
    const getUserUploads = async (): Promise<FileUpload[]> => {
        loading.value = true
        error.value = ''

        try {
            const result = await uploadApi.getUserUploads()
            uploads.value = result.uploads
            return result.uploads
        } catch (err: any) {
            error.value = err.response?.data?.error || 'Failed to get uploads'
            return []
        } finally {
            loading.value = false
        }
    }

    // Set up socket listeners for an upload
    const setupSocketListeners = (uploadId: string) => {
        // Listen for upload progress
        onUploadProgress(uploadId, (data) => {
            // Update progress
            progress.value = {
                uploadedChunks: data.uploadedChunks,
                totalChunks: data.totalChunks,
                progress: data.progress
            }

            // Update upload in list
            const index = uploads.value.findIndex(u => u.id === uploadId)
            if (index !== -1) {
                uploads.value[index].chunks_uploaded = data.uploadedChunks
            }

            // Update current upload
            if (currentUpload.value && currentUpload.value.id === uploadId) {
                currentUpload.value.chunks_uploaded = data.uploadedChunks
            }
        })

        // Listen for upload completed
        onUploadCompleted(uploadId, () => {
            // Update upload status
            const index = uploads.value.findIndex(u => u.id === uploadId)
            if (index !== -1) {
                uploads.value[index].status = 'completed'
            }

            // Update current upload
            if (currentUpload.value && currentUpload.value.id === uploadId) {
                currentUpload.value.status = 'completed'
            }

            // Remove from active uploads
            activeUploads.value = activeUploads.value.filter(id => id !== uploadId)
        })

        // Listen for upload status updates
        onUploadStatusUpdated(uploadId, (data) => {
            // Update upload status
            const index = uploads.value.findIndex(u => u.id === uploadId)
            if (index !== -1) {
                uploads.value[index].status = data.status as FileUpload['status']
            }

            // Update current upload
            if (currentUpload.value && currentUpload.value.id === uploadId) {
                currentUpload.value.status = data.status as FileUpload['status']
            }

            // Update active uploads
            if (data.status === 'paused' || data.status === 'error' || data.status === 'completed') {
                activeUploads.value = activeUploads.value.filter(id => id !== uploadId)
            } else if (data.status === 'uploading' && !activeUploads.value.includes(uploadId)) {
                activeUploads.value.push(uploadId)
            }
        })
    }

    // Reset store
    const reset = () => {
        uploads.value = []
        currentUpload.value = null
        progress.value = null
        activeUploads.value = []
    }

    return {
        // State
        uploads,
        currentUpload,
        loading,
        error,
        progress,
        activeUploads,

        // Getters
        isUploading,
        pendingUploads,
        completedUploads,

        // Actions
        initUpload,
        uploadChunks,
        getUploadStatus,
        updateUploadStatus,
        deleteUpload,
        getUserUploads,
        reset
    }
}) 
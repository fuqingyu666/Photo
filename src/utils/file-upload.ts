import SparkMD5 from 'spark-md5'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'

// Default chunk size: 2MB (can be adjusted based on network conditions)
const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024
const MAX_RETRY_ATTEMPTS = 3
const RETRY_DELAY = 1000 // ms

export interface FileChunk {
    chunk: Blob
    index: number
    hash: string
    size: number
    progress: number
    retries: number
    status: 'pending' | 'uploading' | 'paused' | 'complete' | 'error'
}

export interface UploadTask {
    fileId: string
    fileName: string
    fileSize: number
    fileType: string
    fileHash: string
    uploadId?: string
    chunks: FileChunk[]
    uploadedChunks: number
    status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error'
    progress: number
    createTime: Date
    url?: string
    error?: string
    abortController?: AbortController
}

/**
 * Adaptive chunk size based on network conditions and file size
 */
export const getAdaptiveChunkSize = (fileSize: number): number => {
    // For very large files, use larger chunks
    if (fileSize > 1024 * 1024 * 1024) { // > 1GB
        return 5 * 1024 * 1024; // 5MB
    } else if (fileSize > 100 * 1024 * 1024) { // > 100MB
        return 2 * 1024 * 1024; // 2MB
    } else {
        return 1 * 1024 * 1024; // 1MB
    }
}

/**
 * Calculate file hash using SparkMD5
 */
export const calculateFileHash = (file: File, onProgress?: (progress: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader()
        const spark = new SparkMD5.ArrayBuffer()
        const chunkSize = Math.min(2 * 1024 * 1024, file.size / 10) // Use smaller chunks for hashing
        const chunks = Math.ceil(file.size / chunkSize)
        let currentChunk = 0

        const loadNext = () => {
            if (onProgress) {
                onProgress(Math.min(99, Math.floor((currentChunk / chunks) * 100)))
            }

            const start = currentChunk * chunkSize
            const end = start + chunkSize >= file.size ? file.size : start + chunkSize
            fileReader.readAsArrayBuffer(file.slice(start, end))
        }

        fileReader.onload = (e) => {
            spark.append(e.target?.result as ArrayBuffer)
            currentChunk++

            if (currentChunk < chunks) {
                loadNext()
            } else {
                if (onProgress) {
                    onProgress(100)
                }
                const fileHash = spark.end()
                resolve(fileHash)
            }
        }

        fileReader.onerror = () => {
            reject('Failed to calculate file hash')
        }

        loadNext()
    })
}

/**
 * Create file chunks for upload
 */
export const createFileChunks = async (
    file: File,
    hashProgress?: (progress: number) => void
): Promise<{ chunks: FileChunk[], fileHash: string }> => {
    // Calculate file hash for verification
    const fileHash = await calculateFileHash(file, hashProgress)

    // Determine optimal chunk size based on file size
    const chunkSize = getAdaptiveChunkSize(file.size)
    const chunks: FileChunk[] = []
    const chunkCount = Math.ceil(file.size / chunkSize)

    for (let i = 0; i < chunkCount; i++) {
        const start = i * chunkSize
        const end = start + chunkSize >= file.size ? file.size : start + chunkSize
        const chunk = file.slice(start, end)

        // Calculate chunk hash for verification
        const chunkHash = await calculateChunkHash(chunk)

        chunks.push({
            chunk,
            index: i,
            hash: chunkHash,
            size: chunk.size,
            progress: 0,
            retries: 0,
            status: 'pending'
        })
    }

    return { chunks, fileHash }
}

/**
 * Calculate chunk hash
 */
export const calculateChunkHash = (chunk: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader()
        fileReader.readAsArrayBuffer(chunk)
        fileReader.onload = (e) => {
            const spark = new SparkMD5.ArrayBuffer()
            spark.append(e.target?.result as ArrayBuffer)
            const chunkHash = spark.end()
            resolve(chunkHash)
        }
        fileReader.onerror = () => {
            reject('Failed to calculate chunk hash')
        }
    })
}

/**
 * Create upload task
 */
export const createUploadTask = async (file: File, onHashProgress?: (progress: number) => void): Promise<UploadTask> => {
    try {
        console.log('Creating upload task for file:', file.name)

        // Show hash calculation progress
        const { chunks, fileHash } = await createFileChunks(file, onHashProgress)

        const task: UploadTask = {
            fileId: `file-${uuidv4()}`,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            fileHash,
            chunks,
            uploadedChunks: 0,
            status: 'pending',
            progress: 0,
            createTime: new Date()
        }

        // Try to initialize upload on server
        try {
            const response = await axios.post('/api/upload/init', {
                original_filename: file.name,
                file_size: file.size,
                file_type: file.type,
                file_hash: fileHash,
                chunks_total: chunks.length
            })

            if (response.data && response.data.upload) {
                task.uploadId = response.data.upload.id
                task.uploadedChunks = response.data.upload.chunks_uploaded

                // Update chunk status for already uploaded chunks
                for (let i = 0; i < task.uploadedChunks; i++) {
                    if (task.chunks[i]) {
                        task.chunks[i].status = 'complete'
                        task.chunks[i].progress = 100
                    }
                }

                // Calculate overall progress
                task.progress = (task.uploadedChunks / task.chunks.length) * 100
            }
        } catch (error) {
            console.error('Error initializing upload on server:', error)
            // We'll continue with local task anyway and retry server init on upload start
        }

        return task
    } catch (error) {
        console.error('Error creating upload task:', error)
        throw new Error('Failed to create upload task')
    }
}

/**
 * Upload a single chunk
 */
export const uploadChunk = async (chunk: FileChunk, task: UploadTask): Promise<boolean> => {
    if (!task.uploadId) {
        throw new Error('Upload not initialized on server')
    }

    if (chunk.status === 'complete') {
        return true
    }

    try {
        chunk.status = 'uploading'

        // Create abort controller for this request
        const abortController = new AbortController()
        task.abortController = abortController

        // Create form data
        const formData = new FormData()
        formData.append('upload_id', task.uploadId)
        formData.append('chunk_index', chunk.index.toString())
        formData.append('chunk_hash', chunk.hash)
        formData.append('chunk', chunk.chunk)

        // Upload chunk with progress tracking
        const response = await axios.post('/api/upload/chunk', formData, {
            signal: abortController.signal,
            headers: {
                'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
                if (progressEvent.total) {
                    chunk.progress = Math.round((progressEvent.loaded / progressEvent.total) * 100)
                }
            }
        })

        // Update chunk status and task progress
        chunk.status = 'complete'
        chunk.progress = 100
        task.uploadedChunks++
        task.progress = (task.uploadedChunks / task.chunks.length) * 100

        return true
    } catch (error: any) {
        if (error.name === 'AbortError' || error.message === 'canceled') {
            chunk.status = 'paused'
            return false
        }

        // Handle retry
        chunk.status = 'error'
        chunk.retries++

        if (chunk.retries < MAX_RETRY_ATTEMPTS) {
            console.warn(`Chunk ${chunk.index} upload failed. Retrying (${chunk.retries}/${MAX_RETRY_ATTEMPTS})...`)
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * chunk.retries))
            return uploadChunk(chunk, task)
        }

        console.error(`Chunk ${chunk.index} upload failed after ${MAX_RETRY_ATTEMPTS} attempts.`, error)
        throw error
    }
}

/**
 * Start uploading task
 */
export const startUpload = async (
    task: UploadTask,
    onProgress?: (progress: number, task: UploadTask) => void,
    concurrentChunks: number = 3
): Promise<boolean> => {
    if (task.status === 'completed') return true

    // Set task to uploading state
    task.status = 'uploading'

    try {
        // If we don't have an uploadId yet, initialize the upload on the server
        if (!task.uploadId) {
            try {
                const response = await axios.post('/api/upload/init', {
                    original_filename: task.fileName,
                    file_size: task.fileSize,
                    file_type: task.fileType,
                    file_hash: task.fileHash,
                    chunks_total: task.chunks.length
                })

                if (response.data && response.data.upload) {
                    task.uploadId = response.data.upload.id
                    task.uploadedChunks = response.data.upload.chunks_uploaded

                    // Update chunk status for already uploaded chunks
                    for (let i = 0; i < task.uploadedChunks; i++) {
                        if (task.chunks[i]) {
                            task.chunks[i].status = 'complete'
                            task.chunks[i].progress = 100
                        }
                    }

                    // Calculate overall progress
                    task.progress = (task.uploadedChunks / task.chunks.length) * 100
                } else {
                    throw new Error('Failed to initialize upload on server')
                }
            } catch (error) {
                console.error('Error initializing upload on server:', error)
                task.status = 'error'
                task.error = 'Failed to initialize upload'
                return false
            }
        }

        // Find not uploaded or failed chunks
        const pendingChunks = task.chunks.filter(chunk => chunk.status !== 'complete')

        // Function to upload chunks in batches
        const uploadChunksInBatches = async () => {
            // While we have pending chunks and task is not paused or error
            while (pendingChunks.length > 0 && task.status === 'uploading') {
                // Get the next batch of chunks to upload
                const chunksToUpload = pendingChunks.splice(0, concurrentChunks)

                // Upload chunks in this batch concurrently
                await Promise.all(
                    chunksToUpload.map(async (chunk) => {
                        try {
                            // Retry logic for chunk upload
                            let retryCount = 0;
                            let success = false;

                            while (!success && retryCount < MAX_RETRY_ATTEMPTS && task.status === 'uploading') {
                                try {
                                    await uploadChunk(chunk, task)
                                    success = true;
                                } catch (error) {
                                    retryCount++;
                                    console.warn(`Chunk ${chunk.index} upload failed, retrying (${retryCount}/${MAX_RETRY_ATTEMPTS})`, error);

                                    if (retryCount >= MAX_RETRY_ATTEMPTS) {
                                        throw error;
                                    }

                                    // Wait before retrying
                                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                                }
                            }

                            if (onProgress) {
                                onProgress(task.progress, task)
                            }

                            return success;
                        } catch (error) {
                            console.error(`Error uploading chunk ${chunk.index}:`, error)
                            chunk.status = 'error'

                            // Don't fail the entire upload immediately, let other chunks complete
                            return false
                        }
                    })
                )

                // Save progress periodically
                saveUploadProgress(task)

                // Check if user paused the upload
                if (task.status !== 'uploading') {
                    return false
                }
            }

            // Check if all chunks completed successfully
            const failedChunks = task.chunks.filter(chunk => chunk.status === 'error')
            if (failedChunks.length > 0) {
                task.status = 'error'
                task.error = `Failed to upload ${failedChunks.length} chunks`
                return false
            }

            // All chunks uploaded successfully
            task.status = 'completed'
            task.progress = 100
            task.uploadedChunks = task.chunks.length

            // Notify server that upload is complete
            try {
                await axios.put(`/api/upload/${task.uploadId}/status`, {
                    status: 'completed'
                })
            } catch (error) {
                console.error('Error updating upload status on server:', error)
                // Continue anyway, the chunks are uploaded
            }

            return true
        }

        // Start uploading chunks
        return await uploadChunksInBatches()
    } catch (error) {
        console.error('Error in upload task:', error)
        task.status = 'error'
        task.error = error instanceof Error ? error.message : 'Unknown upload error'
        return false
    }
}

/**
 * Pause upload
 */
export const pauseUpload = (task: UploadTask): void => {
    task.status = 'paused'

    // Abort any in-progress requests
    if (task.abortController) {
        task.abortController.abort()
        task.abortController = undefined
    }

    // Update chunk statuses
    task.chunks.forEach(chunk => {
        if (chunk.status === 'uploading') {
            chunk.status = 'paused'
        }
    })

    // If we have an uploadId, update the status on the server
    if (task.uploadId) {
        axios.put(`/api/upload/${task.uploadId}/status`, {
            status: 'paused'
        }).catch(error => {
            console.error('Error updating upload status on server:', error)
        })
    }
}

/**
 * Resume upload
 */
export const resumeUpload = async (
    task: UploadTask,
    onProgress?: (progress: number, task: UploadTask) => void,
    concurrentChunks: number = 3
): Promise<boolean> => {
    // If we have an uploadId, update the status on the server
    if (task.uploadId) {
        try {
            await axios.put(`/api/upload/${task.uploadId}/status`, {
                status: 'uploading'
            })
        } catch (error) {
            console.error('Error resuming upload on server:', error)
        }
    }

    return startUpload(task, onProgress, concurrentChunks)
}

/**
 * Save upload progress to localStorage for resume later
 */
export const saveUploadProgress = (task: UploadTask): void => {
    try {
        const savedTasks = JSON.parse(localStorage.getItem('uploadTasks') || '{}')

        // Don't save chunk data in localStorage to save space
        const { chunks, abortController, ...taskToSave } = task

        savedTasks[task.fileId] = {
            ...taskToSave,
            createTime: task.createTime.toISOString()
        }

        localStorage.setItem('uploadTasks', JSON.stringify(savedTasks))
    } catch (error) {
        console.error('Error saving upload progress:', error)
    }
}

/**
 * Get saved upload tasks from localStorage
 */
export const getSavedUploadTasks = (): Partial<UploadTask>[] => {
    try {
        const savedTasks = JSON.parse(localStorage.getItem('uploadTasks') || '{}')
        return Object.values(savedTasks).map(task => ({
            ...task,
            createTime: new Date(task.createTime)
        }))
    } catch (error) {
        console.error('Error getting saved upload tasks:', error)
        return []
    }
}

/**
 * Clear saved upload task
 */
export const clearSavedUploadTask = (fileId: string): void => {
    try {
        const savedTasks = JSON.parse(localStorage.getItem('uploadTasks') || '{}')
        delete savedTasks[fileId]
        localStorage.setItem('uploadTasks', JSON.stringify(savedTasks))
    } catch (error) {
        console.error('Error clearing saved upload task:', error)
    }
}

/**
 * Get network speed estimate (in bytes/sec)
 */
export const getNetworkSpeed = (): Promise<number> => {
    return new Promise((resolve) => {
        // Create a small test file (10KB)
        const testData = new ArrayBuffer(10 * 1024)
        const testBlob = new Blob([testData])

        const startTime = Date.now()

        // Upload the test file
        const formData = new FormData()
        formData.append('speedTest', new File([testBlob], 'speedtest'))

        axios.post('/api/upload/speed-test', formData)
            .then(() => {
                const endTime = Date.now()
                const duration = (endTime - startTime) / 1000 // seconds
                const speed = (10 * 1024) / duration // bytes per second
                resolve(speed)
            })
            .catch(() => {
                // If speed test fails, assume a conservative speed
                resolve(50 * 1024) // 50KB/s
            })
    })
} 
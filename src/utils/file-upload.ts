import SparkMD5 from 'spark-md5'

// Chunk size: 2MB
const CHUNK_SIZE = 2 * 1024 * 1024

export interface FileChunk {
    chunk: Blob
    index: number
    hash: string
    progress: number
}

export interface UploadTask {
    fileId: string
    fileName: string
    fileSize: number
    fileType: string
    fileHash: string
    chunks: FileChunk[]
    uploadedChunks: number
    status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error'
    progress: number
    createTime: Date
}

/**
 * Calculate file hash using SparkMD5
 */
export const calculateFileHash = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader()
        const spark = new SparkMD5.ArrayBuffer()
        const chunks = Math.ceil(file.size / CHUNK_SIZE)
        let currentChunk = 0

        const loadNext = () => {
            const start = currentChunk * CHUNK_SIZE
            const end = start + CHUNK_SIZE >= file.size ? file.size : start + CHUNK_SIZE
            fileReader.readAsArrayBuffer(file.slice(start, end))
        }

        fileReader.onload = (e) => {
            spark.append(e.target?.result as ArrayBuffer)
            currentChunk++

            if (currentChunk < chunks) {
                loadNext()
            } else {
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
 * Create file chunks
 */
export const createFileChunks = async (file: File): Promise<FileChunk[]> => {
    const fileHash = await calculateFileHash(file)
    const chunks: FileChunk[] = []
    const chunkCount = Math.ceil(file.size / CHUNK_SIZE)

    for (let i = 0; i < chunkCount; i++) {
        const start = i * CHUNK_SIZE
        const end = start + CHUNK_SIZE >= file.size ? file.size : start + CHUNK_SIZE
        const chunk = file.slice(start, end)

        // Calculate chunk hash for verification
        const chunkHash = await calculateChunkHash(chunk)

        chunks.push({
            chunk,
            index: i,
            hash: chunkHash,
            progress: 0
        })
    }

    return chunks
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
export const createUploadTask = async (file: File): Promise<UploadTask> => {
    const fileHash = await calculateFileHash(file)
    const chunks = await createFileChunks(file)

    const task: UploadTask = {
        fileId: `file-${Date.now()}`,
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

    return task
}

/**
 * Mock upload chunk function
 */
export const uploadChunk = (chunk: FileChunk, task: UploadTask): Promise<boolean> => {
    return new Promise((resolve) => {
        // Simulate chunk upload with progress events
        const totalTime = 1000 + Math.random() * 2000
        const interval = 100
        let progress = 0

        const updateProgress = () => {
            progress += (interval / totalTime) * 100
            chunk.progress = Math.min(100, progress)

            if (progress >= 100) {
                task.uploadedChunks++
                task.progress = (task.uploadedChunks / task.chunks.length) * 100
                resolve(true)
            } else {
                setTimeout(updateProgress, interval)
            }
        }

        updateProgress()
    })
}

/**
 * Start uploading task
 */
export const startUpload = async (task: UploadTask, onProgress?: (progress: number) => void): Promise<boolean> => {
    if (task.status === 'completed') return true

    task.status = 'uploading'

    // Try to upload all chunks
    try {
        // Find not uploaded or failed chunks
        const pendingChunks = task.chunks.filter(chunk => chunk.progress < 100)

        // Upload all chunks in parallel
        await Promise.all(
            pendingChunks.map(async (chunk) => {
                const result = await uploadChunk(chunk, task)
                if (onProgress) {
                    onProgress(task.progress)
                }
                return result
            })
        )

        // Check if all chunks uploaded
        if (task.uploadedChunks === task.chunks.length) {
            // Simulate merging chunks on server
            await new Promise(resolve => setTimeout(resolve, 1000))

            task.status = 'completed'
            task.progress = 100
            if (onProgress) {
                onProgress(100)
            }
            return true
        }

        return false
    } catch (error) {
        task.status = 'error'
        return false
    }
}

/**
 * Pause upload
 */
export const pauseUpload = (task: UploadTask): void => {
    task.status = 'paused'
}

/**
 * Resume upload
 */
export const resumeUpload = async (
    task: UploadTask,
    onProgress?: (progress: number) => void
): Promise<boolean> => {
    return startUpload(task, onProgress)
}

/**
 * Save upload progress to localStorage for resume later
 */
export const saveUploadProgress = (task: UploadTask): void => {
    const savedTasks = JSON.parse(localStorage.getItem('uploadTasks') || '{}')
    savedTasks[task.fileId] = {
        fileId: task.fileId,
        fileName: task.fileName,
        fileSize: task.fileSize,
        fileType: task.fileType,
        fileHash: task.fileHash,
        uploadedChunks: task.uploadedChunks,
        status: task.status,
        progress: task.progress,
        createTime: task.createTime
    }
    localStorage.setItem('uploadTasks', JSON.stringify(savedTasks))
}

/**
 * Get saved upload tasks from localStorage
 */
export const getSavedUploadTasks = (): Partial<UploadTask>[] => {
    const savedTasks = JSON.parse(localStorage.getItem('uploadTasks') || '{}')
    return Object.values(savedTasks)
}

/**
 * Clear saved upload task
 */
export const clearSavedUploadTask = (fileId: string): void => {
    const savedTasks = JSON.parse(localStorage.getItem('uploadTasks') || '{}')
    delete savedTasks[fileId]
    localStorage.setItem('uploadTasks', JSON.stringify(savedTasks))
} 
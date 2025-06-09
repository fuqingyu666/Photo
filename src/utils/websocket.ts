import { io, Socket } from 'socket.io-client'
import { PhotoComment } from '../store/photo'

// WebSocket 地址，在生产环境中替换为实际的后端URL
const WS_URL = import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:3001'

export interface CommentEvent {
    photoId: string
    comment: PhotoComment
}

export interface UploadProgressEvent {
    uploadId: string
    uploadedChunks: number
    totalChunks: number
    progress: number
}

export interface UploadCompletedEvent {
    uploadId: string
    filename: string
}

export interface UploadStatusEvent {
    uploadId: string
    status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error'
}

class WebSocketService {
    private socket: Socket | null = null
    private connected = false
    private reconnectAttempts = 0
    private maxReconnectAttempts = 5
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
    private reconnectInterval = 5000 // 5秒

    // 事件监听器
    private commentListeners: Map<string, Array<(event: CommentEvent) => void>> = new Map()
    private uploadProgressListeners: Map<string, Array<(event: UploadProgressEvent) => void>> = new Map()
    private uploadCompletedListeners: Map<string, Array<(event: UploadCompletedEvent) => void>> = new Map()
    private uploadStatusListeners: Map<string, Array<(event: UploadStatusEvent) => void>> = new Map()
    private connectionListeners: Array<(connected: boolean) => void> = []

    // 连接到WebSocket服务器
    connect(): Promise<boolean> {
        return new Promise((resolve) => {
            if (this.connected && this.socket) {
                resolve(true)
                return
            }

            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout)
                this.reconnectTimeout = null
            }

            try {
                this.socket = io(WS_URL, {
                    transports: ['websocket'],
                    reconnection: false, // 我们自己处理重连
                    timeout: 10000 // 10秒
                })

                this.socket.on('connect', () => {
                    console.log('WebSocket connected')
                    this.connected = true
                    this.reconnectAttempts = 0
                    this.notifyConnectionListeners(true)
                    resolve(true)
                })

                this.socket.on('disconnect', () => {
                    console.log('WebSocket disconnected')
                    this.connected = false
                    this.notifyConnectionListeners(false)
                    this.reconnect()
                })

                this.socket.on('connect_error', (error: Error) => {
                    console.error('WebSocket connection error:', error)
                    this.connected = false
                    this.notifyConnectionListeners(false)
                    this.reconnect()
                    resolve(false)
                })

                this.setupSocketListeners()
            } catch (error) {
                console.error('Error setting up WebSocket:', error)
                this.connected = false
                this.reconnect()
                resolve(false)
            }
        })
    }

    // 尝试重新连接
    private attemptReconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout)
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Maximum reconnection attempts reached')
            return
        }

        this.reconnectAttempts++
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

        this.reconnectTimeout = setTimeout(() => {
            console.log('Reconnecting...')
            this.connect()
        }, this.reconnectInterval * Math.min(this.reconnectAttempts, 3))
    }

    // 设置Socket事件监听器
    private setupSocketListeners(): void {
        if (!this.socket) return

        // 评论事件
        this.socket.on('comment', (event: CommentEvent) => {
            this.notifyCommentListeners(event.photoId, event)
        })

        // 上传进度事件
        this.socket.on('upload-progress', (event: UploadProgressEvent) => {
            this.notifyUploadProgressListeners(event.uploadId, event)
        })

        // 上传完成事件
        this.socket.on('upload-completed', (event: UploadCompletedEvent) => {
            this.notifyUploadCompletedListeners(event.uploadId, event)
        })

        // 上传状态事件
        this.socket.on('upload-status-updated', (event: UploadStatusEvent) => {
            this.notifyUploadStatusListeners(event.uploadId, event)
        })
    }

    // 断开与WebSocket服务器的连接
    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect()
            this.socket = null
        }

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout)
            this.reconnectTimeout = null
        }

        this.connected = false
        this.reconnectAttempts = 0
        this.notifyConnectionListeners(false)
        this.clearAllListeners()
    }

    // 检查连接状态
    isConnected(): boolean {
        return this.connected
    }

    // 订阅特定照片的评论
    subscribeToComments(photoId: string): void {
        if (!this.connected || !this.socket) {
            this.connect().then(() => {
                this.subscribeToComments(photoId)
            })
            return
        }

        this.socket.emit('subscribe-comments', { photoId })
        console.log(`Subscribed to comments for photo ${photoId}`)
    }

    // 取消订阅特定照片的评论
    unsubscribeFromComments(photoId: string): void {
        if (!this.connected || !this.socket) return

        this.socket.emit('unsubscribe-comments', { photoId })
        console.log(`Unsubscribed from comments for photo ${photoId}`)
    }

    // 加入上传房间以接收上传事件
    joinUploadRoom(uploadId: string): void {
        if (!this.connected || !this.socket) {
            this.connect().then(() => {
                this.joinUploadRoom(uploadId)
            })
            return
        }

        this.socket.emit('join-upload-room', { uploadId })
        console.log(`Joined upload room for upload ${uploadId}`)
    }

    // 离开上传房间
    leaveUploadRoom(uploadId: string): void {
        if (!this.connected || !this.socket) return

        this.socket.emit('leave-upload-room', { uploadId })
        console.log(`Left upload room for upload ${uploadId}`)
    }

    // 添加照片评论监听器
    addCommentListener(photoId: string, listener: (event: CommentEvent) => void): void {
        if (!this.commentListeners.has(photoId)) {
            this.commentListeners.set(photoId, [])
        }
        this.commentListeners.get(photoId)!.push(listener)
    }

    // 移除评论监听器
    removeCommentListener(photoId: string, listener?: (event: CommentEvent) => void): void {
        if (!this.commentListeners.has(photoId)) return

        if (!listener) {
            this.commentListeners.delete(photoId)
            return
        }

        const listeners = this.commentListeners.get(photoId)
        if (listeners) {
            const index = listeners.indexOf(listener)
            if (index !== -1) {
                listeners.splice(index, 1)
            }
        }
    }

    // 添加上传进度监听器
    addUploadProgressListener(uploadId: string, listener: (event: UploadProgressEvent) => void): void {
        if (!this.uploadProgressListeners.has(uploadId)) {
            this.uploadProgressListeners.set(uploadId, [])
        }
        this.uploadProgressListeners.get(uploadId)!.push(listener)
    }

    // 添加上传完成监听器
    addUploadCompletedListener(uploadId: string, listener: (event: UploadCompletedEvent) => void): void {
        if (!this.uploadCompletedListeners.has(uploadId)) {
            this.uploadCompletedListeners.set(uploadId, [])
        }
        this.uploadCompletedListeners.get(uploadId)!.push(listener)
    }

    // 添加上传状态监听器
    addUploadStatusListener(uploadId: string, listener: (event: UploadStatusEvent) => void): void {
        if (!this.uploadStatusListeners.has(uploadId)) {
            this.uploadStatusListeners.set(uploadId, [])
        }
        this.uploadStatusListeners.get(uploadId)!.push(listener)
    }

    // 添加连接状态监听器
    addConnectionListener(listener: (connected: boolean) => void): void {
        // 立即通知当前状态
        listener(this.connected)
        this.connectionListeners.push(listener)
    }

    // 移除连接状态监听器
    removeConnectionListener(listener: (connected: boolean) => void): void {
        const index = this.connectionListeners.indexOf(listener)
        if (index !== -1) {
            this.connectionListeners.splice(index, 1)
        }
    }

    // 发送评论
    sendComment(photoId: string, comment: Omit<PhotoComment, 'id' | 'createdAt'>): void {
        if (!this.connected || !this.socket) {
            this.connect().then(() => {
                this.sendComment(photoId, comment)
            })
            return
        }

        this.socket.emit('send-comment', { photoId, comment })
    }

    // 清除所有事件监听器
    private clearAllListeners(): void {
        this.commentListeners.clear()
        this.uploadProgressListeners.clear()
        this.uploadCompletedListeners.clear()
        this.uploadStatusListeners.clear()
        this.connectionListeners = []
    }

    // 通知评论监听器
    private notifyCommentListeners(photoId: string, event: CommentEvent): void {
        if (!this.commentListeners.has(photoId)) return

        const listeners = this.commentListeners.get(photoId)
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(event)
                } catch (error) {
                    console.error('Error in comment listener:', error)
                }
            })
        }
    }

    // 通知上传进度监听器
    private notifyUploadProgressListeners(uploadId: string, event: UploadProgressEvent): void {
        if (!this.uploadProgressListeners.has(uploadId)) return

        const listeners = this.uploadProgressListeners.get(uploadId)
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(event)
                } catch (error) {
                    console.error('Error in upload progress listener:', error)
                }
            })
        }
    }

    // 通知上传完成监听器
    private notifyUploadCompletedListeners(uploadId: string, event: UploadCompletedEvent): void {
        if (!this.uploadCompletedListeners.has(uploadId)) return

        const listeners = this.uploadCompletedListeners.get(uploadId)
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(event)
                } catch (error) {
                    console.error('Error in upload completed listener:', error)
                }
            })
        }
    }

    // 通知上传状态监听器
    private notifyUploadStatusListeners(uploadId: string, event: UploadStatusEvent): void {
        if (!this.uploadStatusListeners.has(uploadId)) return

        const listeners = this.uploadStatusListeners.get(uploadId)
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(event)
                } catch (error) {
                    console.error('Error in upload status listener:', error)
                }
            })
        }
    }

    // 通知连接状态监听器
    private notifyConnectionListeners(connected: boolean): void {
        this.connectionListeners.forEach(listener => {
            try {
                listener(connected)
            } catch (error) {
                console.error('Error in connection listener:', error)
            }
        })
    }

    private reconnect(): void {
        this.attemptReconnect()
    }
}

export const webSocketService = new WebSocketService()

// 辅助函数，便于使用WebSocket服务
export const onCommentAdded = (photoId: string, callback: (event: CommentEvent) => void): void => {
    webSocketService.addCommentListener(photoId, callback)
}

export const onUploadProgress = (uploadId: string, callback: (event: UploadProgressEvent) => void): void => {
    webSocketService.addUploadProgressListener(uploadId, callback)
}

export const onUploadCompleted = (uploadId: string, callback: (event: UploadCompletedEvent) => void): void => {
    webSocketService.addUploadCompletedListener(uploadId, callback)
}

export const onUploadStatusUpdated = (uploadId: string, callback: (event: UploadStatusEvent) => void): void => {
    webSocketService.addUploadStatusListener(uploadId, callback)
}

export const onConnectionChange = (callback: (connected: boolean) => void): void => {
    webSocketService.addConnectionListener(callback)
}

export const joinUploadRoom = (uploadId: string): void => {
    webSocketService.joinUploadRoom(uploadId)
}

// 初始化websocket连接
export const initWebSocket = (): Promise<boolean> => {
    return webSocketService.connect()
} 
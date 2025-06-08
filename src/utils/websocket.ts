import { io, Socket } from 'socket.io-client'
import { PhotoComment } from '../store/photo'

// WebSocket URL, replace with your actual backend URL in production
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
    private reconnectInterval = 5000 // 5 seconds

    // Event listeners
    private commentListeners: Map<string, Array<(event: CommentEvent) => void>> = new Map()
    private uploadProgressListeners: Map<string, Array<(event: UploadProgressEvent) => void>> = new Map()
    private uploadCompletedListeners: Map<string, Array<(event: UploadCompletedEvent) => void>> = new Map()
    private uploadStatusListeners: Map<string, Array<(event: UploadStatusEvent) => void>> = new Map()
    private connectionListeners: Array<(connected: boolean) => void> = []

    // Connect to WebSocket server
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
                    reconnection: false, // We'll handle reconnection ourselves
                    timeout: 10000 // 10 seconds
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

    // Attempt to reconnect
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

    // Setup socket event listeners
    private setupSocketListeners(): void {
        if (!this.socket) return

        // Comment events
        this.socket.on('comment', (event: CommentEvent) => {
            this.notifyCommentListeners(event.photoId, event)
        })

        // Upload progress events
        this.socket.on('upload-progress', (event: UploadProgressEvent) => {
            this.notifyUploadProgressListeners(event.uploadId, event)
        })

        // Upload completed events
        this.socket.on('upload-completed', (event: UploadCompletedEvent) => {
            this.notifyUploadCompletedListeners(event.uploadId, event)
        })

        // Upload status events
        this.socket.on('upload-status-updated', (event: UploadStatusEvent) => {
            this.notifyUploadStatusListeners(event.uploadId, event)
        })
    }

    // Disconnect from WebSocket server
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

    // Check connection status
    isConnected(): boolean {
        return this.connected
    }

    // Subscribe to comments for a specific photo
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

    // Unsubscribe from comments for a specific photo
    unsubscribeFromComments(photoId: string): void {
        if (!this.connected || !this.socket) return

        this.socket.emit('unsubscribe-comments', { photoId })
        console.log(`Unsubscribed from comments for photo ${photoId}`)
    }

    // Join upload room to receive upload events
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

    // Leave upload room
    leaveUploadRoom(uploadId: string): void {
        if (!this.connected || !this.socket) return

        this.socket.emit('leave-upload-room', { uploadId })
        console.log(`Left upload room for upload ${uploadId}`)
    }

    // Add comment listener for a specific photo
    addCommentListener(photoId: string, listener: (event: CommentEvent) => void): void {
        if (!this.commentListeners.has(photoId)) {
            this.commentListeners.set(photoId, [])
        }

        this.commentListeners.get(photoId)?.push(listener)
    }

    // Remove comment listener
    removeCommentListener(photoId: string, listener: (event: CommentEvent) => void): void {
        const listeners = this.commentListeners.get(photoId)
        if (!listeners) return

        const index = listeners.indexOf(listener)
        if (index !== -1) {
            listeners.splice(index, 1)
        }

        if (listeners.length === 0) {
            this.commentListeners.delete(photoId)
        }
    }

    // Add upload progress listener
    addUploadProgressListener(uploadId: string, listener: (event: UploadProgressEvent) => void): void {
        if (!this.uploadProgressListeners.has(uploadId)) {
            this.uploadProgressListeners.set(uploadId, [])
        }

        this.uploadProgressListeners.get(uploadId)?.push(listener)
    }

    // Add upload completed listener
    addUploadCompletedListener(uploadId: string, listener: (event: UploadCompletedEvent) => void): void {
        if (!this.uploadCompletedListeners.has(uploadId)) {
            this.uploadCompletedListeners.set(uploadId, [])
        }

        this.uploadCompletedListeners.get(uploadId)?.push(listener)
    }

    // Add upload status listener
    addUploadStatusListener(uploadId: string, listener: (event: UploadStatusEvent) => void): void {
        if (!this.uploadStatusListeners.has(uploadId)) {
            this.uploadStatusListeners.set(uploadId, [])
        }

        this.uploadStatusListeners.get(uploadId)?.push(listener)
    }

    // Add connection status listener
    addConnectionListener(listener: (connected: boolean) => void): void {
        this.connectionListeners.push(listener)
        // Immediately notify with current status
        listener(this.connected)
    }

    // Remove connection listener
    removeConnectionListener(listener: (connected: boolean) => void): void {
        const index = this.connectionListeners.indexOf(listener)
        if (index !== -1) {
            this.connectionListeners.splice(index, 1)
        }
    }

    // Send a comment
    sendComment(photoId: string, comment: Omit<PhotoComment, 'id' | 'createdAt'>): void {
        if (!this.connected || !this.socket) {
            this.connect().then(() => {
                this.sendComment(photoId, comment)
            })
            return
        }

        this.socket.emit('send-comment', {
            photoId,
            content: comment.content,
            userId: comment.userId,
            username: comment.username
        })
    }

    // Clear all event listeners
    private clearAllListeners(): void {
        this.commentListeners.clear()
        this.uploadProgressListeners.clear()
        this.uploadCompletedListeners.clear()
        this.uploadStatusListeners.clear()
        this.connectionListeners = []
    }

    // Notify comment listeners for a specific photo
    private notifyCommentListeners(photoId: string, event: CommentEvent): void {
        const listeners = this.commentListeners.get(photoId)
        if (!listeners) return

        listeners.forEach(listener => {
            try {
                listener(event)
            } catch (error) {
                console.error('Error in comment listener:', error)
            }
        })
    }

    // Notify upload progress listeners for a specific upload
    private notifyUploadProgressListeners(uploadId: string, event: UploadProgressEvent): void {
        const listeners = this.uploadProgressListeners.get(uploadId)
        if (!listeners) return

        listeners.forEach(listener => {
            try {
                listener(event)
            } catch (error) {
                console.error('Error in upload progress listener:', error)
            }
        })
    }

    // Notify upload completed listeners for a specific upload
    private notifyUploadCompletedListeners(uploadId: string, event: UploadCompletedEvent): void {
        const listeners = this.uploadCompletedListeners.get(uploadId)
        if (!listeners) return

        listeners.forEach(listener => {
            try {
                listener(event)
            } catch (error) {
                console.error('Error in upload completed listener:', error)
            }
        })
    }

    // Notify upload status listeners for a specific upload
    private notifyUploadStatusListeners(uploadId: string, event: UploadStatusEvent): void {
        const listeners = this.uploadStatusListeners.get(uploadId)
        if (!listeners) return

        listeners.forEach(listener => {
            try {
                listener(event)
            } catch (error) {
                console.error('Error in upload status listener:', error)
            }
        })
    }

    // Notify connection listeners
    private notifyConnectionListeners(connected: boolean): void {
        this.connectionListeners.forEach(listener => {
            try {
                listener(connected)
            } catch (error) {
                console.error('Error in connection listener:', error)
            }
        })
    }
}

export const webSocketService = new WebSocketService()

// Helper functions for easy usage of the WebSocket service

export const onCommentAdded = (photoId: string, callback: (event: CommentEvent) => void): void => {
    webSocketService.addCommentListener(photoId, callback)
    webSocketService.subscribeToComments(photoId)
}

export const onUploadProgress = (uploadId: string, callback: (event: UploadProgressEvent) => void): void => {
    webSocketService.addUploadProgressListener(uploadId, callback)
    webSocketService.joinUploadRoom(uploadId)
}

export const onUploadCompleted = (uploadId: string, callback: (event: UploadCompletedEvent) => void): void => {
    webSocketService.addUploadCompletedListener(uploadId, callback)
    webSocketService.joinUploadRoom(uploadId)
}

export const onUploadStatusUpdated = (uploadId: string, callback: (event: UploadStatusEvent) => void): void => {
    webSocketService.addUploadStatusListener(uploadId, callback)
    webSocketService.joinUploadRoom(uploadId)
}

export const onConnectionChange = (callback: (connected: boolean) => void): void => {
    webSocketService.addConnectionListener(callback)
}

export const joinUploadRoom = (uploadId: string): void => {
    webSocketService.joinUploadRoom(uploadId)
}

// Initialize websocket connection
let connectionInitiated = false

export const initWebSocket = (): Promise<boolean> => {
    if (connectionInitiated) return Promise.resolve(webSocketService.isConnected())

    connectionInitiated = true
    return webSocketService.connect()
} 
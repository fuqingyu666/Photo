import { io, Socket } from 'socket.io-client'
import { PhotoComment } from '../store/photo'

// Mock WebSocket URL, in a real app this would be your actual server endpoint
const WS_URL = 'ws://localhost:3000'

export interface CommentEvent {
    photoId: string
    comment: PhotoComment
}

class WebSocketService {
    private socket: Socket | null = null
    private connected = false
    private commentListeners: ((event: CommentEvent) => void)[] = []

    // Connect to WebSocket server
    connect(): Promise<boolean> {
        return new Promise((resolve) => {
            // In a real app, we would connect to a real WebSocket server
            // For this demo, we'll simulate the connection

            // Simulate connection delay
            setTimeout(() => {
                this.connected = true
                console.log('WebSocket connected (mock)')
                resolve(true)

                // Start the mock server that will generate mock comments
                this.startMockServer()
            }, 500)
        })
    }

    // Disconnect from WebSocket server
    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect()
            this.socket = null
        }

        this.connected = false
        this.commentListeners = []
        console.log('WebSocket disconnected')
    }

    // Check connection status
    isConnected(): boolean {
        return this.connected
    }

    // Subscribe to comments for a specific photo
    subscribeToComments(photoId: string): void {
        console.log(`Subscribed to comments for photo ${photoId}`)
        // In a real app, we would send a subscription message to the server
    }

    // Unsubscribe from comments for a specific photo
    unsubscribeFromComments(photoId: string): void {
        console.log(`Unsubscribed from comments for photo ${photoId}`)
        // In a real app, we would send an unsubscribe message to the server
    }

    // Add comment listener
    addCommentListener(listener: (event: CommentEvent) => void): void {
        this.commentListeners.push(listener)
    }

    // Remove comment listener
    removeCommentListener(listener: (event: CommentEvent) => void): void {
        const index = this.commentListeners.indexOf(listener)
        if (index !== -1) {
            this.commentListeners.splice(index, 1)
        }
    }

    // Send a comment (in a real app, this would send to the server)
    sendComment(photoId: string, comment: Omit<PhotoComment, 'id' | 'createdAt'>): void {
        const fullComment: PhotoComment = {
            ...comment,
            id: `comment-${Date.now()}`,
            createdAt: new Date()
        }

        // In a real app, we would send this to the server and let the server broadcast
        // For this demo, we'll simulate receiving it back from the server
        setTimeout(() => {
            this.notifyCommentListeners({
                photoId,
                comment: fullComment
            })
        }, 100)

        console.log(`Comment sent for photo ${photoId}: ${comment.content}`)
    }

    // Notify all comment listeners
    private notifyCommentListeners(event: CommentEvent): void {
        this.commentListeners.forEach(listener => {
            listener(event)
        })
    }

    // Mock server that generates random comments
    private startMockServer(): void {
        // Generate a random comment every 20-40 seconds
        const generateRandomComment = () => {
            // Skip if no listeners
            if (this.commentListeners.length === 0) {
                return
            }

            // Generate random photo ID
            const photoId = `photo-${Math.floor(Math.random() * 50) + 1}`

            // Generate random user
            const users = [
                { id: '101', username: 'randomUser1', avatar: 'https://randomuser.me/api/portraits/women/5.jpg' },
                { id: '102', username: 'randomUser2', avatar: 'https://randomuser.me/api/portraits/men/5.jpg' },
                { id: '103', username: 'randomUser3', avatar: 'https://randomuser.me/api/portraits/women/6.jpg' },
                { id: '104', username: 'randomUser4', avatar: 'https://randomuser.me/api/portraits/men/6.jpg' }
            ]
            const user = users[Math.floor(Math.random() * users.length)]

            // Generate random comment content
            const comments = [
                "Great photo!",
                "Love this shot!",
                "Amazing composition!",
                "What camera did you use for this?",
                "The colors are stunning!",
                "Beautiful moment captured.",
                "Wow, incredible detail!",
                "This is one of your best works!",
                "Thanks for sharing this!",
                "Absolutely fantastic!"
            ]
            const content = comments[Math.floor(Math.random() * comments.length)]

            // Create comment
            const comment: PhotoComment = {
                id: `mock-comment-${Date.now()}`,
                userId: user.id,
                username: user.username,
                avatar: user.avatar,
                content,
                createdAt: new Date()
            }

            // Notify listeners
            this.notifyCommentListeners({
                photoId,
                comment
            })

            console.log(`Random comment generated for photo ${photoId}`)

            // Schedule next random comment
            setTimeout(generateRandomComment, Math.random() * 20000 + 20000)
        }

        // Start generating comments after a delay
        setTimeout(generateRandomComment, 10000)
    }
}

export const webSocketService = new WebSocketService() 
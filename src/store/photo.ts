import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface PhotoComment {
    id: string
    userId: string
    username: string
    avatar: string
    content: string
    createdAt: Date
}

export interface Photo {
    id: string
    userId: string
    username: string
    userAvatar: string
    title: string
    description: string
    imageUrl: string
    createdAt: Date
    likes: number
    liked: boolean
    comments: PhotoComment[]
}

// Generate mock data
const generateMockPhotos = (): Photo[] => {
    const mockUsers = [
        { id: '1', username: 'alice', avatar: 'https://randomuser.me/api/portraits/women/1.jpg' },
        { id: '2', username: 'bob', avatar: 'https://randomuser.me/api/portraits/men/1.jpg' },
        { id: '3', username: 'charlie', avatar: 'https://randomuser.me/api/portraits/men/2.jpg' },
        { id: '4', username: 'dana', avatar: 'https://randomuser.me/api/portraits/women/2.jpg' }
    ]

    const photos: Photo[] = []

    // Generate 50 mock photos
    for (let i = 0; i < 50; i++) {
        const userIndex = Math.floor(Math.random() * mockUsers.length)
        const user = mockUsers[userIndex]
        const photoId = `photo-${i + 1}`

        // Generate 0-5 random comments
        const comments: PhotoComment[] = []
        const commentCount = Math.floor(Math.random() * 6)

        for (let j = 0; j < commentCount; j++) {
            const commentUserIndex = Math.floor(Math.random() * mockUsers.length)
            const commentUser = mockUsers[commentUserIndex]

            comments.push({
                id: `comment-${i}-${j}`,
                userId: commentUser.id,
                username: commentUser.username,
                avatar: commentUser.avatar,
                content: `This is a comment on photo #${i + 1}. It's really great!`,
                createdAt: new Date(Date.now() - Math.floor(Math.random() * 10000000))
            })
        }

        // Create the photo object
        photos.push({
            id: photoId,
            userId: user.id,
            username: user.username,
            userAvatar: user.avatar,
            title: `Photo #${i + 1}`,
            description: `This is a description for photo #${i + 1}. It was taken at a beautiful location.`,
            imageUrl: `https://picsum.photos/seed/${photoId}/800/600`,
            createdAt: new Date(Date.now() - Math.floor(Math.random() * 10000000)),
            likes: Math.floor(Math.random() * 100),
            liked: Math.random() > 0.5,
            comments
        })
    }

    return photos
}

// Photo Store
export const usePhotoStore = defineStore('photo', () => {
    const photos = ref<Photo[]>([])
    const userPhotos = ref<Photo[]>([])
    const currentPhoto = ref<Photo | null>(null)
    const isLoading = ref(false)
    const error = ref('')

    // Initialize with mock data
    const mockPhotos = generateMockPhotos()
    photos.value = mockPhotos

    // Set user's photos based on userId
    const setUserPhotos = (userId: string) => {
        userPhotos.value = photos.value.filter(photo => photo.userId === userId)
    }

    // Get photo by ID
    const getPhotoById = (id: string) => {
        const photo = photos.value.find(p => p.id === id)
        if (photo) {
            currentPhoto.value = { ...photo }
            return photo
        }
        currentPhoto.value = null
        return null
    }

    // Add a new photo
    const addPhoto = (photo: Omit<Photo, 'id' | 'createdAt' | 'likes' | 'liked' | 'comments'>) => {
        const newPhoto: Photo = {
            ...photo,
            id: `photo-${Date.now()}`,
            createdAt: new Date(),
            likes: 0,
            liked: false,
            comments: []
        }

        photos.value.unshift(newPhoto)
        userPhotos.value.unshift(newPhoto)
        return newPhoto
    }

    // Delete a photo
    const deletePhoto = (id: string) => {
        const index = photos.value.findIndex(p => p.id === id)
        if (index !== -1) {
            photos.value.splice(index, 1)
        }

        const userIndex = userPhotos.value.findIndex(p => p.id === id)
        if (userIndex !== -1) {
            userPhotos.value.splice(userIndex, 1)
        }
    }

    // Toggle like on a photo
    const toggleLike = (id: string) => {
        const photo = photos.value.find(p => p.id === id)
        if (photo) {
            photo.liked = !photo.liked
            photo.likes += photo.liked ? 1 : -1
        }

        // Update current photo if it's the same
        if (currentPhoto.value && currentPhoto.value.id === id) {
            currentPhoto.value.liked = !currentPhoto.value.liked
            currentPhoto.value.likes += currentPhoto.value.liked ? 1 : -1
        }
    }

    // Add comment to a photo
    const addComment = (photoId: string, comment: Omit<PhotoComment, 'id' | 'createdAt'>) => {
        const photo = photos.value.find(p => p.id === photoId)
        const newComment: PhotoComment = {
            ...comment,
            id: `comment-${Date.now()}`,
            createdAt: new Date()
        }

        if (photo) {
            photo.comments.push(newComment)
        }

        // Update current photo if it's the same
        if (currentPhoto.value && currentPhoto.value.id === photoId) {
            currentPhoto.value.comments.push(newComment)
        }

        return newComment
    }

    return {
        photos,
        userPhotos,
        currentPhoto,
        isLoading,
        error,
        setUserPhotos,
        getPhotoById,
        addPhoto,
        deletePhoto,
        toggleLike,
        addComment
    }
}) 
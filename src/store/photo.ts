import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as photoApi from '../api/photo'
import { Photo, PhotoCreate, PhotoUpdate } from '../api/photo'

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
    // State
    const photos = ref<Photo[]>([])
    const sharedPhotos = ref<Photo[]>([])
    const currentPhoto = ref<Photo | null>(null)
    const loading = ref(false)
    const error = ref('')
    const pagination = ref({
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
    })
    const sharedPagination = ref({
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
    })

    // Getters
    const hasMorePhotos = computed(() => {
        return pagination.value.page < pagination.value.pages
    })

    const hasMoreSharedPhotos = computed(() => {
        return sharedPagination.value.page < sharedPagination.value.pages
    })

    // Actions
    // Get user photos
    const getUserPhotos = async (page: number = 1, limit: number = 20) => {
        loading.value = true
        error.value = ''

        try {
            const response = await photoApi.getUserPhotos(page, limit)

            if (page === 1) {
                photos.value = response.photos
            } else {
                photos.value = [...photos.value, ...response.photos]
            }

            pagination.value = response.pagination
            return response.photos
        } catch (err: any) {
            error.value = err.response?.data?.error || 'Failed to get photos'
            return []
        } finally {
            loading.value = false
        }
    }

    // Get shared photos
    const getSharedPhotos = async (page: number = 1, limit: number = 20) => {
        loading.value = true
        error.value = ''

        try {
            const response = await photoApi.getSharedPhotos(page, limit)

            if (page === 1) {
                sharedPhotos.value = response.photos
            } else {
                sharedPhotos.value = [...sharedPhotos.value, ...response.photos]
            }

            sharedPagination.value = response.pagination
            return response.photos
        } catch (err: any) {
            error.value = err.response?.data?.error || 'Failed to get shared photos'
            return []
        } finally {
            loading.value = false
        }
    }

    // Get photo by ID
    const getPhotoById = async (id: string) => {
        loading.value = true
        error.value = ''

        try {
            const response = await photoApi.getPhotoById(id)
            currentPhoto.value = response.photo
            return response
        } catch (err: any) {
            error.value = err.response?.data?.error || 'Failed to get photo'
            return null
        } finally {
            loading.value = false
        }
    }

    // Create photo
    const createPhoto = async (data: PhotoCreate) => {
        loading.value = true
        error.value = ''

        try {
            const photo = await photoApi.createPhoto(data)
            photos.value = [photo, ...photos.value]
            return photo
        } catch (err: any) {
            error.value = err.response?.data?.error || 'Failed to create photo'
            return null
        } finally {
            loading.value = false
        }
    }

    // Update photo
    const updatePhoto = async (id: string, data: PhotoUpdate) => {
        loading.value = true
        error.value = ''

        try {
            const updatedPhoto = await photoApi.updatePhoto(id, data)

            // Update in photos array
            const index = photos.value.findIndex(p => p.id === id)
            if (index !== -1) {
                photos.value[index] = updatedPhoto
            }

            // Update current photo if it's the same
            if (currentPhoto.value && currentPhoto.value.id === id) {
                currentPhoto.value = updatedPhoto
            }

            return updatedPhoto
        } catch (err: any) {
            error.value = err.response?.data?.error || 'Failed to update photo'
            return null
        } finally {
            loading.value = false
        }
    }

    // Delete photo
    const deletePhoto = async (id: string) => {
        loading.value = true
        error.value = ''

        try {
            await photoApi.deletePhoto(id)

            // Remove from photos array
            photos.value = photos.value.filter(p => p.id !== id)

            // Clear current photo if it's the same
            if (currentPhoto.value && currentPhoto.value.id === id) {
                currentPhoto.value = null
            }

            return true
        } catch (err: any) {
            error.value = err.response?.data?.error || 'Failed to delete photo'
            return false
        } finally {
            loading.value = false
        }
    }

    // Share photo
    const sharePhoto = async (id: string, userId: string) => {
        loading.value = true
        error.value = ''

        try {
            await photoApi.sharePhoto(id, { sharedWithUserId: userId })
            return true
        } catch (err: any) {
            error.value = err.response?.data?.error || 'Failed to share photo'
            return false
        } finally {
            loading.value = false
        }
    }

    // Unshare photo
    const unsharePhoto = async (id: string, userId: string) => {
        loading.value = true
        error.value = ''

        try {
            await photoApi.unsharePhoto(id, { sharedWithUserId: userId })
            return true
        } catch (err: any) {
            error.value = err.response?.data?.error || 'Failed to unshare photo'
            return false
        } finally {
            loading.value = false
        }
    }

    // Reset store
    const reset = () => {
        photos.value = []
        sharedPhotos.value = []
        currentPhoto.value = null
        pagination.value = {
            page: 1,
            limit: 20,
            total: 0,
            pages: 0
        }
        sharedPagination.value = {
            page: 1,
            limit: 20,
            total: 0,
            pages: 0
        }
    }

    return {
        // State
        photos,
        sharedPhotos,
        currentPhoto,
        loading,
        error,
        pagination,
        sharedPagination,

        // Getters
        hasMorePhotos,
        hasMoreSharedPhotos,

        // Actions
        getUserPhotos,
        getSharedPhotos,
        getPhotoById,
        createPhoto,
        updatePhoto,
        deletePhoto,
        sharePhoto,
        unsharePhoto,
        reset
    }
}) 
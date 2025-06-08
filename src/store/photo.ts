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
    isPrivate?: boolean
    isShared?: boolean
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

        // 随机决定是否为私有照片和是否共享
        const isPrivate = Math.random() < 0.3 // 30%的照片为私有
        const isShared = !isPrivate && Math.random() < 0.7 // 对于非私有照片，70%是共享的

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
            comments,
            isPrivate,
            isShared
        })
    }

    return photos
}

// Photo Store
export const usePhotoStore = defineStore('photo', () => {
    // State
    const photos = ref<Photo[]>([])
    const userPhotos = ref<Photo[]>([])
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

    // 获取用户照片（包括私有和共享）
    const fetchUserPhotos = async (userId?: string) => {
        if (!userId) {
            userPhotos.value = []
            return []
        }

        loading.value = true
        error.value = ''

        try {
            // 调用实际API获取用户照片
            const response = await photoApi.getUserPhotos(1, 100)
            userPhotos.value = response.photos.map(photo => ({
                id: photo.id,
                userId: photo.user_id,
                username: photo.username || 'User',
                userAvatar: '',
                title: photo.title,
                description: photo.description || '',
                imageUrl: photo.url,
                createdAt: new Date(photo.created_at || Date.now()),
                likes: 0,
                liked: false,
                comments: [],
                isPrivate: !!photo.is_private,
                isShared: !!photo.is_shared
            }))
            return userPhotos.value
        } catch (err: any) {
            console.error('Error fetching user photos:', err)
            error.value = err?.message || 'Failed to fetch user photos'
            userPhotos.value = [] // 确保即使出错也是空数组而不是null
            return []
        } finally {
            loading.value = false
        }
    }

    // 获取共享照片
    const fetchSharedPhotos = async () => {
        loading.value = true
        error.value = ''

        try {
            // 调用实际API获取共享照片
            const response = await photoApi.getSharedPhotos(1, 100)
            sharedPhotos.value = response.photos.map(photo => ({
                id: photo.id,
                userId: photo.user_id,
                username: photo.username || 'User',
                userAvatar: '',
                title: photo.title,
                description: photo.description || '',
                imageUrl: photo.url,
                createdAt: new Date(photo.created_at || Date.now()),
                likes: 0,
                liked: false,
                comments: [],
                isPrivate: false,
                isShared: true
            }))
            return sharedPhotos.value
        } catch (err: any) {
            console.error('Error fetching shared photos:', err)
            error.value = err?.message || 'Failed to fetch shared photos'
            sharedPhotos.value = []
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
    const updatePhoto = async (id: string, data: Partial<Photo>) => {
        // 在photos数组中查找并更新照片
        const photoIndex = photos.value.findIndex(p => p.id === id);
        if (photoIndex !== -1) {
            photos.value[photoIndex] = { ...photos.value[photoIndex], ...data };
        }

        // 在userPhotos数组中查找并更新照片
        const userPhotoIndex = userPhotos.value.findIndex(p => p.id === id);
        if (userPhotoIndex !== -1) {
            userPhotos.value[userPhotoIndex] = { ...userPhotos.value[userPhotoIndex], ...data };
        }

        // 处理共享状态更改
        const updatedPhoto = photos.value.find(p => p.id === id);
        if (updatedPhoto) {
            // 如果照片变成私有或不共享，从共享列表中移除
            if (updatedPhoto.isPrivate || !updatedPhoto.isShared) {
                sharedPhotos.value = sharedPhotos.value.filter(p => p.id !== id);
            } else {
                // 如果照片变成共享且非私有，确保它在共享列表中
                const sharedIndex = sharedPhotos.value.findIndex(p => p.id === id);
                if (sharedIndex === -1) {
                    sharedPhotos.value.push(updatedPhoto);
                } else {
                    sharedPhotos.value[sharedIndex] = updatedPhoto;
                }
            }
        }

        return updatedPhoto || null;
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

    // 添加照片
    const addPhoto = (data: {
        userId: string;
        username: string;
        userAvatar: string;
        title: string;
        description: string;
        imageUrl: string;
        isPrivate?: boolean;
        isShared?: boolean;
    }): Photo => {
        const newPhoto: Photo = {
            id: `photo-${Date.now()}`,
            userId: data.userId,
            username: data.username,
            userAvatar: data.userAvatar,
            title: data.title || '未命名照片',
            description: data.description || '',
            imageUrl: data.imageUrl,
            createdAt: new Date(),
            likes: 0,
            liked: false,
            comments: [],
            isPrivate: data.isPrivate || false,
            isShared: data.isShared !== undefined ? data.isShared : true
        };

        // 添加到照片列表
        photos.value = [newPhoto, ...photos.value];

        // 如果是当前用户的照片，也添加到用户照片列表
        if (data.userId === userPhotos.value[0]?.userId) {
            userPhotos.value = [newPhoto, ...userPhotos.value];
        }

        // 如果是共享照片，添加到共享照片列表
        if (newPhoto.isShared && !newPhoto.isPrivate) {
            sharedPhotos.value = [newPhoto, ...sharedPhotos.value];
        }

        return newPhoto;
    };

    return {
        // State
        photos,
        userPhotos,
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
        fetchUserPhotos,
        fetchSharedPhotos,
        getPhotoById,
        createPhoto,
        updatePhoto,
        deletePhoto,
        sharePhoto,
        unsharePhoto,
        reset,
        addPhoto
    }
}) 
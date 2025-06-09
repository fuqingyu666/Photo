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
    isFavorite?: boolean
}

// 生成模拟数据
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

// 照片存储
export const usePhotoStore = defineStore('photo', () => {
    // 状态
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
    const favoritePhotos = ref<string[]>([])

    // 初始化时从localStorage加载收藏
    const initFavorites = () => {
        const savedFavorites = localStorage.getItem('favoritePhotos')
        if (savedFavorites) {
            favoritePhotos.value = JSON.parse(savedFavorites)
        }
    }

    // 初始化收藏
    initFavorites()

    // 获取器
    const hasMorePhotos = computed(() => {
        return pagination.value.page < pagination.value.pages
    })

    const hasMoreSharedPhotos = computed(() => {
        return sharedPagination.value.page < sharedPagination.value.pages
    })

    const favoriteCount = computed(() => {
        return favoritePhotos.value.length
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

            // 强制在客户端过滤掉所有私有照片
            const filteredPhotos = response.photos.filter(photo => !photo.is_private);
            console.log(`Filtered out ${response.photos.length - filteredPhotos.length} private photos from shared list`);

            sharedPhotos.value = filteredPhotos.map(photo => ({
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
                isPrivate: false, // 已经过滤，肯定是非私有
                isShared: true
            }))

            // 同步用户照片的收藏状态
            for (const photo of sharedPhotos.value) {
                photo.isFavorite = favoritePhotos.value.includes(photo.id);
            }

            // 额外检查：再次过滤掉用户照片中被标记为私有的照片
            const userPrivatePhotoIds = userPhotos.value
                .filter(p => p.isPrivate)
                .map(p => p.id);

            if (userPrivatePhotoIds.length > 0) {
                // 如果有用户照片被标记为私有，从共享列表中移除它们
                sharedPhotos.value = sharedPhotos.value.filter(
                    photo => !userPrivatePhotoIds.includes(photo.id)
                );
                console.log(`Removed ${userPrivatePhotoIds.length} private user photos from shared list`);
            }

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

    // Toggle favorite status of a photo
    const toggleFavorite = (photoId: string) => {
        const index = favoritePhotos.value.indexOf(photoId)

        // If already in favorites, remove it
        if (index !== -1) {
            favoritePhotos.value.splice(index, 1)
        } else {
            // Otherwise add it
            favoritePhotos.value.push(photoId)
        }

        // Update UI state for this photo in all collections
        updatePhotoFavoriteStatus(photoId)

        // Save to localStorage
        localStorage.setItem('favoritePhotos', JSON.stringify(favoritePhotos.value))
    }

    // Update isFavorite status for a photo in all collections
    const updatePhotoFavoriteStatus = (photoId: string) => {
        const isFavorite = favoritePhotos.value.includes(photoId)

        // Update in photos collection
        const photoIndex = photos.value.findIndex(p => p.id === photoId)
        if (photoIndex !== -1) {
            photos.value[photoIndex].isFavorite = isFavorite
        }

        // Update in userPhotos collection
        const userPhotoIndex = userPhotos.value.findIndex(p => p.id === photoId)
        if (userPhotoIndex !== -1) {
            userPhotos.value[userPhotoIndex].isFavorite = isFavorite
        }

        // Update in sharedPhotos collection
        const sharedPhotoIndex = sharedPhotos.value.findIndex(p => p.id === photoId)
        if (sharedPhotoIndex !== -1) {
            sharedPhotos.value[sharedPhotoIndex].isFavorite = isFavorite
        }

        // Update in currentPhoto if it's the same
        if (currentPhoto.value && currentPhoto.value.id === photoId) {
            currentPhoto.value.isFavorite = isFavorite
        }
    }

    // Get the user's favorite photos
    const getFavoritePhotos = async () => {
        if (favoritePhotos.value.length === 0) {
            return []
        }

        const favPhotos: Photo[] = []

        // First collect all favorite photos from existing collections
        for (const id of favoritePhotos.value) {
            // Look in all our collections
            const photo = photos.value.find(p => p.id === id) ||
                userPhotos.value.find(p => p.id === id) ||
                sharedPhotos.value.find(p => p.id === id)

            if (photo) {
                favPhotos.push({ ...photo, isFavorite: true })
            }
        }

        // For any IDs we couldn't find in our collection, try to fetch individually
        const missingIds = favoritePhotos.value.filter(
            id => !favPhotos.find(p => p.id === id)
        )

        if (missingIds.length > 0) {
            for (const id of missingIds) {
                try {
                    const result = await getPhotoById(id)
                    if (result && result.photo) {
                        favPhotos.push({
                            ...result.photo,
                            isFavorite: true
                        })
                    }
                } catch (err) {
                    console.error(`Failed to fetch favorite photo ${id}:`, err)
                }
            }
        }

        return favPhotos
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
        // Don't reset favorites as they should persist between sessions
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

    // 获取照片详情
    const fetchPhotoById = async (id: string) => {
        loading.value = true;
        error.value = '';

        try {
            const result = await getPhotoById(id);
            if (result && result.photo) {
                currentPhoto.value = result.photo;
                return result.photo;
            }
            return null;
        } catch (err: any) {
            console.error('Error fetching photo by ID:', err);
            error.value = err?.message || 'Failed to fetch photo';
            return null;
        } finally {
            loading.value = false;
        }
    };

    // 将照片设置保存到服务器
    const savePhotoSettings = async (id: string, settings: {
        is_private?: boolean,
        is_shared?: boolean,
        title?: string,
        description?: string
    }) => {
        loading.value = true;
        error.value = '';

        try {
            // 调用API将设置保存到服务器
            const response = await photoApi.updatePhotoSettings(id, settings);

            // 如果照片变成私有，立即从共享列表中移除
            if (settings.is_private === true) {
                removeFromSharedPhotos(id);
            }

            return response;
        } catch (err: any) {
            error.value = err.response?.data?.error || 'Failed to save photo settings';
            console.error('Failed to save photo settings:', err);
            return null;
        } finally {
            loading.value = false;
        }
    };

    // 从共享照片列表中移除指定照片
    const removeFromSharedPhotos = (id: string) => {
        // 检查照片是否在共享列表中
        const photoIndex = sharedPhotos.value.findIndex(photo => photo.id === id);
        if (photoIndex !== -1) {
            console.log(`Removing photo ${id} from shared photos list`);
            // 从sharedPhotos数组中删除指定ID的照片
            sharedPhotos.value.splice(photoIndex, 1);

            // 同时确保在原始照片数据中标记为私有
            const photoInList = photos.value.find(p => p.id === id);
            if (photoInList) {
                photoInList.isPrivate = true;
                photoInList.isShared = false;
            }

            const userPhotoInList = userPhotos.value.find(p => p.id === id);
            if (userPhotoInList) {
                userPhotoInList.isPrivate = true;
                userPhotoInList.isShared = false;
            }
        }
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
        favoritePhotos,

        // Getters
        hasMorePhotos,
        hasMoreSharedPhotos,
        favoriteCount,

        // Actions
        getUserPhotos,
        fetchUserPhotos,
        fetchSharedPhotos,
        getPhotoById,
        createPhoto,
        updatePhoto,
        savePhotoSettings,
        removeFromSharedPhotos,
        deletePhoto,
        sharePhoto,
        unsharePhoto,
        toggleFavorite,
        getFavoritePhotos,
        reset,
        addPhoto,
        fetchPhotoById
    }
}) 
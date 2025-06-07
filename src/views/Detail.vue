<template>
  <app-layout>
    <div class="detail-page">
      <template v-if="isLoading">
        <div class="loading-container">
          <el-skeleton animated>
            <template #template>
              <div class="skeleton-item skeleton-image"></div>
              <div class="skeleton-item skeleton-title"></div>
              <div class="skeleton-item skeleton-text"></div>
              <div class="skeleton-item skeleton-text"></div>
            </template>
          </el-skeleton>
        </div>
      </template>
      
      <template v-else-if="!photo">
        <div class="not-found">
          <el-empty description="Photo not found">
            <el-button type="primary" @click="$router.push('/shared')">
              Back to Shared Photos
            </el-button>
          </el-empty>
        </div>
      </template>
      
      <template v-else>
        <div class="photo-detail-container">
          <div class="photo-content">
            <div class="photo-image-container">
              <img :src="photo.imageUrl" :alt="photo.title" class="photo-image">
            </div>
            
            <div class="photo-info">
              <div class="photo-header">
                <h1 class="photo-title">{{ photo.title }}</h1>
                <div class="photo-actions">
                  <el-button 
                    :type="photo.liked ? 'danger' : 'default'"
                    @click="toggleLike"
                  >
                    <el-icon><star /></el-icon>
                    {{ photo.liked ? 'Liked' : 'Like' }} ({{ photo.likes }})
                  </el-button>
                  
                  <el-button @click="scrollToComments">
                    <el-icon><chat-round /></el-icon>
                    Comments ({{ photo.comments.length }})
                  </el-button>
                </div>
              </div>
              
              <div class="user-info">
                <el-avatar :src="photo.userAvatar" :size="40"></el-avatar>
                <div class="user-details">
                  <span class="username">{{ photo.username }}</span>
                  <span class="date">{{ formatDate(photo.createdAt) }}</span>
                </div>
              </div>
              
              <div class="photo-description">
                <p>{{ photo.description }}</p>
              </div>
            </div>
            
            <div class="comments-section" ref="commentsSection">
              <h2>Comments ({{ photo.comments.length }})</h2>
              
              <div class="comment-form">
                <el-avatar :src="userAvatar" :size="40"></el-avatar>
                <div class="comment-input-container">
                  <el-input
                    v-model="commentText"
                    type="textarea"
                    :rows="2"
                    placeholder="Write a comment..."
                    resize="none"
                    @keyup.enter.native="submitComment"
                  />
                  <el-button 
                    type="primary" 
                    @click="submitComment" 
                    :disabled="!commentText.trim()"
                  >
                    Post
                  </el-button>
                </div>
              </div>
              
              <div class="comments-list">
                <div v-if="photo.comments.length === 0" class="no-comments">
                  <p>No comments yet. Be the first to comment!</p>
                </div>
                
                <div 
                  v-for="comment in sortedComments" 
                  :key="comment.id" 
                  class="comment-item"
                  :class="{ 'new-comment': isNewComment(comment.id) }"
                >
                  <el-avatar :src="comment.avatar" :size="40"></el-avatar>
                  <div class="comment-content">
                    <div class="comment-header">
                      <span class="comment-username">{{ comment.username }}</span>
                      <span class="comment-date">{{ formatDate(comment.createdAt) }}</span>
                    </div>
                    <p class="comment-text">{{ comment.content }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="related-photos">
            <h3>Related Photos</h3>
            <div class="related-photos-list">
              <div 
                v-for="relatedPhoto in relatedPhotos" 
                :key="relatedPhoto.id" 
                class="related-photo-item"
                @click="viewRelatedPhoto(relatedPhoto.id)"
              >
                <img :src="relatedPhoto.imageUrl" :alt="relatedPhoto.title">
                <div class="related-photo-info">
                  <h4>{{ relatedPhoto.title }}</h4>
                  <p>by {{ relatedPhoto.username }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
    
    <!-- Add this component for photo sharing -->
    <div v-if="showShareDialog" class="share-dialog-overlay" @click.self="closeShareDialog">
      <div class="share-dialog">
        <div class="share-dialog-header">
          <h3>分享照片</h3>
          <button class="close-button" @click="closeShareDialog">×</button>
        </div>
        
        <div class="share-dialog-content">
          <div class="search-container">
            <input 
              type="text" 
              v-model="searchQuery" 
              placeholder="搜索用户名或邮箱..." 
              @input="searchUsers"
              class="search-input"
            />
            <div v-if="isSearching" class="search-loading">搜索中...</div>
          </div>
          
          <div v-if="searchResults.length > 0" class="search-results">
            <div 
              v-for="user in searchResults" 
              :key="user.id" 
              class="user-item"
              :class="{ 'shared': isSharedWithUser(user.id) }"
              @click="toggleShareWithUser(user.id)"
            >
              <div class="user-avatar">
                <img v-if="user.avatar" :src="user.avatar" :alt="user.username" />
                <div v-else class="avatar-placeholder">{{ user.username.charAt(0).toUpperCase() }}</div>
              </div>
              <div class="user-info">
                <div class="username">{{ user.username }}</div>
                <div class="email">{{ user.email }}</div>
              </div>
              <div class="share-status">
                <span v-if="isSharedWithUser(user.id)" class="shared-icon">✓</span>
                <span v-else class="share-icon">+</span>
              </div>
            </div>
          </div>
          
          <div v-else-if="searchQuery && !isSearching" class="no-results">
            没有找到匹配的用户
          </div>
          
          <div class="shared-with-section">
            <h4>已分享用户</h4>
            <div v-if="sharedUsers.length > 0" class="shared-users-list">
              <div v-for="user in sharedUsers" :key="user.id" class="user-item shared">
                <div class="user-avatar">
                  <img v-if="user.avatar" :src="user.avatar" :alt="user.username" />
                  <div v-else class="avatar-placeholder">{{ user.username.charAt(0).toUpperCase() }}</div>
                </div>
                <div class="user-info">
                  <div class="username">{{ user.username }}</div>
                  <div class="email">{{ user.email }}</div>
                </div>
                <button class="remove-share-button" @click="unshareWithUser(user.id)">
                  移除
                </button>
              </div>
            </div>
            <div v-else class="no-shared-users">
              此照片尚未分享给任何用户
            </div>
          </div>
        </div>
        
        <div class="share-dialog-footer">
          <button class="cancel-button" @click="closeShareDialog">关闭</button>
        </div>
      </div>
    </div>
  </app-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Star, ChatRound } from '@element-plus/icons-vue'
import AppLayout from '../components/AppLayout.vue'
import { usePhotoStore, Photo, PhotoComment } from '../store/photo'
import { useAuthStore } from '../store/auth'
import { webSocketService, CommentEvent } from '../utils/websocket'
import { searchUsers, getPhotoShares } from '../api/photo'

const route = useRoute()
const router = useRouter()
const photoStore = usePhotoStore()
const authStore = useAuthStore()

const isLoading = ref(true)
const commentText = ref('')
const commentsSection = ref<HTMLElement | null>(null)
const newCommentIds = ref<string[]>([])

// Get photo ID from route params
const photoId = computed(() => route.params.id as string)

// Get current photo
const photo = computed(() => photoStore.currentPhoto)

// Get user avatar
const userAvatar = computed(() => authStore.user?.avatar || 'https://randomuser.me/api/portraits/lego/1.jpg')

// Sort comments by date (newest first)
const sortedComments = computed(() => {
  if (!photo.value) return []
  
  return [...photo.value.comments].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
})

// Get related photos (same user or similar titles, excluding current photo)
const relatedPhotos = computed(() => {
  if (!photo.value) return []
  
  return photoStore.photos
    .filter(p => 
      p.id !== photo.value?.id && 
      (p.userId === photo.value?.userId || 
       p.title.toLowerCase().includes(photo.value?.title.toLowerCase().split(' ')[0] || ''))
    )
    .slice(0, 4)
})

// Check if comment is new
const isNewComment = (commentId: string): boolean => {
  return newCommentIds.value.includes(commentId)
}

// Load photo details
onMounted(async () => {
  // Load photo
  photoStore.getPhotoById(photoId.value)
  
  // Simulate loading delay
  setTimeout(() => {
    isLoading.value = false
  }, 800)
  
  // Connect to WebSocket and subscribe to comments
  await webSocketService.connect()
  webSocketService.subscribeToComments(photoId.value)
  webSocketService.addCommentListener(handleNewComment)
})

// Clean up on component unmount
onBeforeUnmount(() => {
  webSocketService.unsubscribeFromComments(photoId.value)
  webSocketService.removeCommentListener(handleNewComment)
})

// Handle new comment from WebSocket
const handleNewComment = (event: CommentEvent) => {
  if (event.photoId === photoId.value && photo.value) {
    // Add comment to the photo
    photo.value.comments.push(event.comment)
    
    // Mark as new comment
    newCommentIds.value.push(event.comment.id)
    
    // Remove from new comments after 5 seconds
    setTimeout(() => {
      const index = newCommentIds.value.indexOf(event.comment.id)
      if (index !== -1) {
        newCommentIds.value.splice(index, 1)
      }
    }, 5000)
    
    // Scroll to bottom of comments
    nextTick(() => {
      scrollToComments()
    })
  }
}

// Toggle like on the photo
const toggleLike = () => {
  if (photo.value) {
    photoStore.toggleLike(photo.value.id)
  }
}

// Submit a new comment
const submitComment = () => {
  if (!commentText.value.trim() || !photo.value || !authStore.user) return
  
  // Send comment via WebSocket
  webSocketService.sendComment(photo.value.id, {
    userId: authStore.user.id,
    username: authStore.user.username,
    avatar: authStore.user.avatar || 'https://randomuser.me/api/portraits/lego/1.jpg',
    content: commentText.value.trim()
  })
  
  // Clear comment text
  commentText.value = ''
}

// Scroll to comments section
const scrollToComments = () => {
  if (commentsSection.value) {
    commentsSection.value.scrollIntoView({ behavior: 'smooth' })
  }
}

// View related photo
const viewRelatedPhoto = (id: string) => {
  router.push(`/detail/${id}`)
}

// Format date
const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Photo sharing functionality
const showShareDialog = ref(false)
const searchQuery = ref('')
const searchResults = ref<any[]>([])
const sharedUsers = ref<any[]>([])
const isSearching = ref(false)
const shareError = ref('')

// Open share dialog
const openShareDialog = async () => {
  showShareDialog.value = true
  searchQuery.value = ''
  searchResults.value = []
  await loadSharedUsers()
}

// Close share dialog
const closeShareDialog = () => {
  showShareDialog.value = false
}

// Load users who have access to this photo
const loadSharedUsers = async () => {
  if (!photoStore.currentPhoto) return
  
  try {
    sharedUsers.value = await getPhotoShares(photoStore.currentPhoto.id)
  } catch (error) {
    console.error('Error loading shared users:', error)
  }
}

// Search users for sharing
const searchUsers = async () => {
  if (searchQuery.value.length < 2) {
    searchResults.value = []
    return
  }
  
  isSearching.value = true
  
  try {
    // Debounce search
    await new Promise(resolve => setTimeout(resolve, 300))
    searchResults.value = await searchUsers(searchQuery.value)
  } catch (error) {
    console.error('Error searching users:', error)
  } finally {
    isSearching.value = false
  }
}

// Check if photo is shared with a user
const isSharedWithUser = (userId: string): boolean => {
  return sharedUsers.value.some(user => user.id === userId)
}

// Toggle share with user
const toggleShareWithUser = async (userId: string) => {
  if (!photoStore.currentPhoto) return
  
  try {
    if (isSharedWithUser(userId)) {
      await photoStore.unsharePhoto(photoStore.currentPhoto.id, userId)
      sharedUsers.value = sharedUsers.value.filter(user => user.id !== userId)
    } else {
      await photoStore.sharePhoto(photoStore.currentPhoto.id, userId)
      const user = searchResults.value.find(user => user.id === userId)
      if (user && !sharedUsers.value.some(u => u.id === userId)) {
        sharedUsers.value.push(user)
      }
    }
  } catch (error) {
    console.error('Error toggling share:', error)
    shareError.value = '分享操作失败，请重试'
  }
}

// Unshare with user
const unshareWithUser = async (userId: string) => {
  if (!photoStore.currentPhoto) return
  
  try {
    await photoStore.unsharePhoto(photoStore.currentPhoto.id, userId)
    sharedUsers.value = sharedUsers.value.filter(user => user.id !== userId)
  } catch (error) {
    console.error('Error unsharing photo:', error)
    shareError.value = '取消分享失败，请重试'
  }
}
</script>

<style lang="scss" scoped>
.detail-page {
  width: 100%;
}

.loading-container {
  max-width: 1000px;
  margin: 0 auto;
  
  .skeleton-image {
    height: 400px;
    margin-bottom: 24px;
  }
  
  .skeleton-title {
    height: 32px;
    margin-bottom: 16px;
  }
  
  .skeleton-text {
    height: 16px;
    margin-bottom: 8px;
  }
}

.not-found {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.photo-detail-container {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
  
  @media (max-width: 992px) {
    grid-template-columns: 1fr;
  }
}

.photo-content {
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.photo-image-container {
  width: 100%;
  max-height: 600px;
  overflow: hidden;
  
  .photo-image {
    width: 100%;
    height: auto;
    object-fit: contain;
  }
}

.photo-info {
  padding: 24px;
}

.photo-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
  }
  
  .photo-title {
    font-size: 24px;
    margin: 0;
    color: #303133;
  }
  
  .photo-actions {
    display: flex;
    gap: 8px;
  }
}

.user-info {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  
  .user-details {
    margin-left: 12px;
    display: flex;
    flex-direction: column;
    
    .username {
      font-weight: 600;
      font-size: 16px;
    }
    
    .date {
      font-size: 14px;
      color: #909399;
    }
  }
}

.photo-description {
  margin-bottom: 24px;
  line-height: 1.6;
  color: #606266;
}

.comments-section {
  padding: 24px;
  border-top: 1px solid #e6e6e6;
  
  h2 {
    font-size: 20px;
    margin: 0 0 16px;
  }
}

.comment-form {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  
  .comment-input-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    .el-button {
      align-self: flex-end;
    }
  }
}

.comments-list {
  .no-comments {
    text-align: center;
    color: #909399;
    padding: 24px 0;
  }
}

.comment-item {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding: 16px;
  border-radius: 8px;
  transition: background-color 0.3s ease;
  
  &.new-comment {
    background-color: #ecf5ff;
    animation: highlight 5s ease;
  }
  
  .comment-content {
    flex: 1;
    
    .comment-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      
      .comment-username {
        font-weight: 600;
      }
      
      .comment-date {
        font-size: 12px;
        color: #909399;
      }
    }
    
    .comment-text {
      margin: 0;
      line-height: 1.5;
    }
  }
}

.related-photos {
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  padding: 24px;
  
  h3 {
    font-size: 18px;
    margin: 0 0 16px;
  }
  
  .related-photos-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .related-photo-item {
    display: flex;
    gap: 12px;
    cursor: pointer;
    padding: 8px;
    border-radius: 4px;
    transition: background-color 0.3s ease;
    
    &:hover {
      background-color: #f5f7fa;
    }
    
    img {
      width: 80px;
      height: 60px;
      object-fit: cover;
      border-radius: 4px;
    }
    
    .related-photo-info {
      flex: 1;
      
      h4 {
        margin: 0 0 4px;
        font-size: 14px;
      }
      
      p {
        margin: 0;
        font-size: 12px;
        color: #909399;
      }
    }
  }
}

@keyframes highlight {
  0% {
    background-color: #ecf5ff;
  }
  80% {
    background-color: #ecf5ff;
  }
  100% {
    background-color: transparent;
  }
}

@media (max-width: 768px) {
  .photo-header {
    .photo-actions {
      width: 100%;
      justify-content: space-between;
    }
  }
  
  .comment-form {
    flex-direction: column;
    align-items: center;
    
    .el-avatar {
      margin-bottom: 8px;
    }
    
    .comment-input-container {
      width: 100%;
    }
  }
}

// Add these styles for the share dialog
.share-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.share-dialog {
  background-color: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

.share-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #ebeef5;
  
  h3 {
    margin: 0;
    font-size: 18px;
    color: #303133;
  }
  
  .close-button {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #909399;
    
    &:hover {
      color: #606266;
    }
  }
}

.share-dialog-content {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.search-container {
  margin-bottom: 16px;
  position: relative;
  
  .search-input {
    width: 100%;
    padding: 10px 16px;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    font-size: 14px;
    
    &:focus {
      outline: none;
      border-color: #409eff;
    }
  }
  
  .search-loading {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 12px;
    color: #909399;
  }
}

.search-results {
  margin-bottom: 24px;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.no-results {
  text-align: center;
  padding: 16px;
  color: #909399;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.shared-with-section {
  h4 {
    margin: 0 0 12px;
    font-size: 16px;
    color: #303133;
  }
}

.shared-users-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.no-shared-users {
  text-align: center;
  padding: 16px;
  color: #909399;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.user-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #f5f7fa;
  }
  
  &.shared {
    background-color: #ecf5ff;
    
    &:hover {
      background-color: #d9ecff;
    }
  }
  
  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    margin-right: 12px;
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .avatar-placeholder {
      width: 100%;
      height: 100%;
      background-color: #409eff;
      color: white;
      display: flex;
      justify-content: center;
      align-items: center;
      font-weight: bold;
    }
  }
  
  .user-info {
    flex: 1;
    
    .username {
      font-weight: 500;
      margin-bottom: 4px;
    }
    
    .email {
      font-size: 12px;
      color: #909399;
    }
  }
  
  .share-status {
    width: 24px;
    height: 24px;
    display: flex;
    justify-content: center;
    align-items: center;
    
    .shared-icon {
      color: #67c23a;
      font-weight: bold;
    }
    
    .share-icon {
      color: #409eff;
      font-weight: bold;
    }
  }
  
  .remove-share-button {
    padding: 6px 12px;
    background-color: #f56c6c;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    
    &:hover {
      background-color: #e64242;
    }
  }
}

.share-dialog-footer {
  padding: 16px 24px;
  border-top: 1px solid #ebeef5;
  display: flex;
  justify-content: flex-end;
  
  .cancel-button {
    padding: 8px 20px;
    background-color: #f0f2f5;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    
    &:hover {
      background-color: #e6e8eb;
    }
  }
}
</style> 
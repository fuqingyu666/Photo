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
</style> 
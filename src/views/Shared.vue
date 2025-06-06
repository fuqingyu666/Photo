<template>
  <app-layout>
    <div class="shared-page">
      <div class="page-header">
        <h1>Shared Photos</h1>
        <div class="filter-actions">
          <el-input
            v-model="searchQuery"
            placeholder="Search photos..."
            prefix-icon="el-icon-search"
            clearable
            class="search-input"
          />
        </div>
      </div>
      
      <div class="content-section">
        <template v-if="isLoading">
          <div class="loading-container">
            <div v-for="i in 6" :key="i" class="skeleton-card">
              <el-skeleton animated>
                <template #template>
                  <div class="skeleton-item skeleton-image"></div>
                  <div class="skeleton-item skeleton-title"></div>
                  <div class="skeleton-item skeleton-text"></div>
                  <div class="skeleton-item skeleton-text"></div>
                </template>
              </el-skeleton>
            </div>
          </div>
        </template>
        
        <template v-else>
          <div class="virtual-list-container" ref="containerRef" @scroll="onScroll">
            <div 
              class="virtual-list-phantom" 
              :style="{ height: totalHeight + 'px' }"
            ></div>
            
            <div 
              class="virtual-list-content" 
              :style="{ transform: `translateY(${offsetY}px)` }"
            >
              <div class="photo-grid">
                <el-card 
                  v-for="photo in visibleItems" 
                  :key="photo.id" 
                  class="photo-card"
                  shadow="hover"
                >
                  <div class="photo-image" @click="viewPhotoDetail(photo.id)">
                    <img :src="photo.imageUrl" :alt="photo.title">
                  </div>
                  
                  <div class="photo-info">
                    <h3 class="photo-title">{{ photo.title }}</h3>
                    <p class="photo-description">{{ truncateText(photo.description, 80) }}</p>
                    
                    <div class="user-info">
                      <el-avatar :src="photo.userAvatar" :size="32"></el-avatar>
                      <span class="username">{{ photo.username }}</span>
                    </div>
                    
                    <div class="photo-meta">
                      <span class="photo-date">{{ formatDate(photo.createdAt) }}</span>
                      <div class="photo-stats">
                        <span 
                          class="likes" 
                          :class="{ 'liked': photo.liked }" 
                          @click.stop="toggleLike(photo.id)"
                        >
                          <el-icon><star /></el-icon>
                          {{ photo.likes }}
                        </span>
                        <span class="comments">
                          <el-icon><chat-round /></el-icon>
                          {{ photo.comments.length }}
                        </span>
                      </div>
                    </div>
                  </div>
                </el-card>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </app-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Star, ChatRound } from '@element-plus/icons-vue'
import AppLayout from '../components/AppLayout.vue'
import { usePhotoStore } from '../store/photo'
import { useVirtualList } from '../hooks/useVirtualList'

const router = useRouter()
const photoStore = usePhotoStore()
const isLoading = ref(true)
const searchQuery = ref('')

// Filter photos based on search query
const filteredPhotos = computed(() => {
  if (!searchQuery.value.trim()) {
    return photoStore.photos
  }
  
  const query = searchQuery.value.toLowerCase()
  return photoStore.photos.filter(photo => 
    photo.title.toLowerCase().includes(query) || 
    photo.description.toLowerCase().includes(query) ||
    photo.username.toLowerCase().includes(query)
  )
})

// Set up virtual list
const ITEM_HEIGHT = 320 // Approximate height of each card
const { 
  containerRef, 
  visibleItems, 
  totalHeight, 
  offsetY, 
  onScroll 
} = useVirtualList({
  list: filteredPhotos,
  itemHeight: ITEM_HEIGHT,
  containerHeight: 800,
  bufferSize: 3
})

// Load photos
onMounted(() => {
  // Simulate loading delay
  setTimeout(() => {
    isLoading.value = false
  }, 800)
})

// View photo detail
const viewPhotoDetail = (id: string) => {
  router.push(`/detail/${id}`)
}

// Toggle like on a photo
const toggleLike = (id: string) => {
  photoStore.toggleLike(id)
}

// Helper function to truncate text
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// Format date
const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>

<style lang="scss" scoped>
.shared-page {
  width: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  
  h1 {
    font-size: 28px;
    margin: 0;
    color: #303133;
  }
  
  .filter-actions {
    display: flex;
    gap: 16px;
    
    .search-input {
      width: 240px;
    }
  }
}

.content-section {
  margin-bottom: 40px;
  position: relative;
}

.loading-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.skeleton-card {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  background-color: #fff;
  padding: 16px;
  
  .skeleton-image {
    height: 200px;
    margin-bottom: 16px;
  }
  
  .skeleton-title {
    height: 24px;
    margin-bottom: 16px;
  }
  
  .skeleton-text {
    height: 16px;
    margin-bottom: 8px;
  }
}

.virtual-list-container {
  height: 800px;
  overflow-y: auto;
  position: relative;
}

.virtual-list-phantom {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  z-index: -1;
}

.virtual-list-content {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  min-height: 100px;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.photo-card {
  transition: transform 0.3s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
  
  &:hover {
    transform: translateY(-5px);
  }
}

.photo-image {
  cursor: pointer;
  height: 200px;
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
    
    &:hover {
      transform: scale(1.05);
    }
  }
}

.photo-info {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.photo-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
}

.photo-description {
  color: #606266;
  margin-bottom: 16px;
  line-height: 1.5;
  flex: 1;
}

.user-info {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  
  .username {
    margin-left: 8px;
    font-size: 14px;
    color: #606266;
  }
}

.photo-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #909399;
}

.photo-stats {
  display: flex;
  gap: 16px;
  
  .likes, .comments {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    
    &.liked {
      color: #f56c6c;
    }
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .filter-actions {
    width: 100%;
    
    .search-input {
      width: 100%;
    }
  }
  
  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  }
}

@media (max-width: 480px) {
  .photo-grid {
    grid-template-columns: 1fr;
  }
}
</style> 
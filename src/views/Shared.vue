<template>
  <app-layout>
    <div class="shared-page">
      <div class="page-header">
        <h1>共享照片</h1>
        <div class="filter-actions">
          <el-input
            v-model="searchQuery"
            placeholder="搜索照片..."
            clearable
            class="search-input"
          >
            <template #prefix>
              <el-icon class="el-input__icon"><Search /></el-icon>
            </template>
          </el-input>
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
        
        <template v-else-if="filteredPhotos.length === 0">
          <div class="empty-state">
            <el-empty description="暂无共享照片" />
          </div>
        </template>
        
        <template v-else>
          <div class="photo-grid">
            <el-card 
              v-for="photo in filteredPhotos" 
              :key="photo.id" 
              class="photo-card"
              shadow="hover"
            >
              <div class="photo-image" @click="viewPhotoDetail(photo)">
                <img :src="photo.imageUrl" :alt="photo.title">
              </div>
              
              <div class="photo-info">
                <h3 class="photo-title">{{ photo.title }}</h3>
                <p class="photo-description">{{ truncateText(photo.description, 80) }}</p>
                
                <div class="user-info">
                  <el-avatar :src="photo.userAvatar" :size="32">{{ photo.username.charAt(0).toUpperCase() }}</el-avatar>
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
                      <el-icon><Star /></el-icon>
                      {{ photo.likes }}
                    </span>
                    <span class="comments">
                      <el-icon><ChatRound /></el-icon>
                      {{ photo.comments.length }}
                    </span>
                  </div>
                </div>
              </div>
            </el-card>
          </div>
        </template>
      </div>
    </div>
  </app-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Star, ChatRound, Search } from '@element-plus/icons-vue'
import AppLayout from '../components/AppLayout.vue'
import { usePhotoStore } from '../store/photo'
import { useAuthStore } from '../store/auth'

const router = useRouter()
const photoStore = usePhotoStore()
const authStore = useAuthStore()
const isLoading = ref(true)
const searchQuery = ref('')

// 基于搜索查询过滤照片
const filteredPhotos = computed(() => {
  if (!photoStore.sharedPhotos || photoStore.sharedPhotos.length === 0) {
    return [];
  }
  
  if (!searchQuery.value.trim()) {
    return photoStore.sharedPhotos;
  }
  
  const query = searchQuery.value.toLowerCase();
  return photoStore.sharedPhotos.filter(photo => 
    photo.title.toLowerCase().includes(query) || 
    photo.description.toLowerCase().includes(query) ||
    photo.username.toLowerCase().includes(query)
  );
});

// 加载照片
onMounted(async () => {
  try {
    await photoStore.fetchSharedPhotos();
  } catch (error) {
    ElMessage.error('加载共享照片失败');
  } finally {
    isLoading.value = false;
  }
});

// 查看照片详情
const viewPhotoDetail = (photo: any) => {
  // 如果照片有URL，则直接在新标签打开图片
  if (photo.url) {
    window.open(photo.url, '_blank');
  } else if (photo.imageUrl) {
    window.open(photo.imageUrl, '_blank');
  } else {
    // 如果没有URL，则跳转到详情页
    router.push(`/photo/${photo.id}`);
  }
};

// 切换照片点赞状态
const toggleLike = (id: string) => {
  photoStore.toggleLike(id);
};

// 截断文本的辅助函数
const truncateText = (text: string, maxLength: number): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// 格式化日期
const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};
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
}

.loading-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.skeleton-card {
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.skeleton-item {
  background-color: #f2f2f2;
  margin-bottom: 12px;
}

.skeleton-image {
  height: 160px;
  border-radius: 4px;
}

.skeleton-title {
  height: 24px;
  width: 70%;
  border-radius: 4px;
}

.skeleton-text {
  height: 16px;
  width: 100%;
  border-radius: 4px;
}

.empty-state {
  padding: 60px 0;
  text-align: center;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.photo-card {
  overflow: hidden;
  height: 100%;
  
  &:hover {
    .photo-image img {
      transform: scale(1.05);
    }
  }
}

.photo-image {
  height: 200px;
  overflow: hidden;
  cursor: pointer;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s;
  }
}

.photo-info {
  padding: 16px;
}

.photo-title {
  margin: 0 0 8px;
  font-size: 18px;
  color: #303133;
}

.photo-description {
  color: #606266;
  font-size: 14px;
  margin-bottom: 16px;
  line-height: 1.5;
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
  
  .photo-date {
    font-size: 12px;
    color: #909399;
  }
  
  .photo-stats {
    display: flex;
    gap: 16px;
    
    .likes, .comments {
      display: flex;
      align-items: center;
      font-size: 14px;
      color: #606266;
      
      .el-icon {
        margin-right: 4px;
      }
    }
    
    .likes {
      cursor: pointer;
      
      &.liked {
        color: #f56c6c;
      }
    }
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    
    .filter-actions {
      width: 100%;
      
      .search-input {
        width: 100%;
      }
    }
  }
  
  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }
}
</style> 
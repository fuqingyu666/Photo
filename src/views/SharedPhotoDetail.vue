<template>
  <app-layout>
    <div class="photo-detail-page">
      <div v-if="loading" class="loading-container">
        <el-skeleton :rows="10" animated />
      </div>
      
      <div v-else-if="!photo" class="not-found">
        <el-empty description="照片不存在或已被删除" />
        <el-button @click="goBack">返回</el-button>
      </div>
      
      <template v-else>
        <div class="back-button">
          <el-button @click="goBack" plain>
            <el-icon><ArrowLeft /></el-icon> 返回
          </el-button>
        </div>
        
        <div class="photo-container">
          <div class="photo-main">
            <div class="photo-image">
              <img :src="photo.imageUrl" :alt="decodedTitle" />
            </div>
          </div>
          
          <div class="photo-info">
            <h1 class="photo-title">{{ decodedTitle }}</h1>
            
            <div class="photo-uploader">
              <el-avatar :src="photo.userAvatar" :size="40">
                {{ photo.username ? photo.username.charAt(0).toUpperCase() : '?' }}
              </el-avatar>
              <div class="user-info">
                <div class="username">{{ photo.username }}</div>
                <div class="upload-date">{{ formatDate(photo.createdAt) }}</div>
              </div>
            </div>
            
            <div class="photo-description">
              <p>{{ decodedDescription }}</p>
            </div>
            
            <div class="photo-meta">
              <div class="meta-item">
                <el-icon><Calendar /></el-icon>
                <span>上传于 {{ formatDate(photo.createdAt) }}</span>
              </div>
              
              <div class="meta-item">
                <el-icon><Picture /></el-icon>
                <span>
                  {{ photo.width }} x {{ photo.height }} 像素
                </span>
              </div>
              
              <div class="meta-item">
                <el-icon><Document /></el-icon>
                <span>{{ formatSize(photo.fileSize) }}</span>
              </div>
            </div>
            
            <div class="photo-actions">
              <el-button @click="downloadPhoto">
                <el-icon><Download /></el-icon> 下载
              </el-button>
              
              <el-button 
                :class="{ 'liked': photo.isFavorite }" 
                @click="toggleFavorite"
              >
                <el-icon><Star /></el-icon> 
                {{ photo.isFavorite ? '已收藏' : '收藏' }}
              </el-button>
              
              <el-button @click="sharePhoto">
                <el-icon><Share /></el-icon> 分享
              </el-button>
            </div>
          </div>
        </div>
        
        <!-- 评论组件 -->
        <photo-comments :photo-id="photoId" />
      </template>
    </div>
  </app-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowLeft, Calendar, Picture, Document, Download, Star, Share } from '@element-plus/icons-vue';
import AppLayout from '../components/AppLayout.vue';
import PhotoComments from '../components/PhotoComments.vue';
import { usePhotoStore } from '../store/photo';
import { useAuthStore } from '../store/auth';

const route = useRoute();
const router = useRouter();
const photoStore = usePhotoStore();
const authStore = useAuthStore();

const loading = ref(true);
const photoId = computed(() => route.params.id as string);
const photo = computed(() => photoStore.currentPhoto);

// 解码标题和描述以解决乱码问题
const decodedTitle = computed(() => {
  if (!photo.value || !photo.value.title) return '';
  try {
    return decodeURIComponent(photo.value.title);
  } catch (e) {
    return photo.value.title;
  }
});

const decodedDescription = computed(() => {
  if (!photo.value || !photo.value.description) return '';
  try {
    return decodeURIComponent(photo.value.description);
  } catch (e) {
    return photo.value.description;
  }
});

// 加载照片数据
onMounted(async () => {
  try {
    await photoStore.fetchPhotoById(photoId.value);
    
    if (!photo.value) {
      ElMessage.error('照片不存在或已被删除');
    }
  } catch (error) {
    console.error('Failed to load photo:', error);
    ElMessage.error('加载照片失败');
  } finally {
    loading.value = false;
  }
});

// 返回上一页
const goBack = () => {
  router.back();
};

// 格式化日期
const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 格式化文件大小
const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 下载照片
const downloadPhoto = () => {
  if (!photo.value || !photo.value.imageUrl) {
    ElMessage.error('无法下载照片');
    return;
  }
  
  // 创建临时链接并点击它来触发下载
  const link = document.createElement('a');
  link.href = photo.value.imageUrl;
  link.download = photo.value.originalFilename || photo.value.title || 'photo';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 切换收藏状态
const toggleFavorite = () => {
  if (!photoId.value) return;
  
  photoStore.toggleFavorite(photoId.value);
};

// 分享照片
const sharePhoto = () => {
  // 获取当前页面的URL
  const url = window.location.href;
  
  // 尝试使用Web Share API
  if (navigator.share) {
    navigator.share({
      title: photo.value?.title || '共享照片',
      text: photo.value?.description || '来看看这张照片',
      url: url
    }).catch((error) => {
      console.error('分享失败:', error);
      copyToClipboard(url);
    });
  } else {
    // 如果不支持Web Share API，则复制链接到剪贴板
    copyToClipboard(url);
  }
};

// 复制文本到剪贴板
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('链接已复制到剪贴板');
  }).catch(() => {
    ElMessage.error('复制链接失败');
  });
};
</script>

<style lang="scss" scoped>
.photo-detail-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
}

.back-button {
  margin-bottom: 20px;
}

.loading-container, .not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 20px;
}

.photo-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 30px;
  margin-bottom: 40px;
  
  @media (min-width: 768px) {
    grid-template-columns: 2fr 1fr;
  }
}

.photo-main {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.photo-image {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  background-color: #f5f5f5;
  
  img {
    width: 100%;
    height: auto;
    object-fit: contain;
    display: block;
  }
}

.photo-title {
  font-size: 24px;
  margin: 0 0 16px 0;
}

.photo-uploader {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  
  .user-info {
    display: flex;
    flex-direction: column;
    
    .username {
      font-weight: 600;
    }
    
    .upload-date {
      font-size: 14px;
      color: #999;
    }
  }
}

.photo-description {
  margin-bottom: 24px;
  white-space: pre-wrap;
  
  p {
    margin: 0;
    line-height: 1.6;
  }
}

.photo-meta {
  border-top: 1px solid #eee;
  padding: 16px 0;
  margin-bottom: 16px;
  
  .meta-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    
    .el-icon {
      color: #909399;
    }
  }
}

.photo-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  
  .liked {
    color: #ff5252;
    background-color: #ffebee;
  }
}

.photo-actions .liked {
  color: #ff5252;
  border-color: #ff5252;
}

.photo-actions .liked:hover {
  background-color: #ffebee;
}
</style> 
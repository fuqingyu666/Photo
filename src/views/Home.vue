<template>
  <app-layout>
    <div class="home-page">
      <div class="page-header">
        <h1>个人主页</h1>
        <div class="header-actions">
          <el-select v-model="sortBy" placeholder="排序方式" class="sort-select">
            <el-option label="最新上传" value="newest" />
            <el-option label="最早上传" value="oldest" />
            <el-option label="按名称" value="name" />
          </el-select>
          
          <el-input
            v-model="searchQuery"
            placeholder="搜索图片..."
            prefix-icon="el-icon-search"
            clearable
            @clear="handleSearchClear"
            class="search-input"
          />
        </div>
      </div>
      
      <div v-if="isLoading" class="loading-container">
        <el-skeleton :rows="3" animated />
      </div>
      
      <div v-else-if="filteredPhotos.length === 0 && !isLoading" class="empty-state">
        <el-empty description="没有找到照片">
          <template #description>
            <p>您尚未上传任何照片或没有符合搜索条件的结果</p>
          </template>
          <router-link to="/upload">
            <el-button type="primary">上传照片</el-button>
          </router-link>
        </el-empty>
      </div>
      
      <div v-else class="photo-grid">
        <div 
          v-for="photo in filteredPhotos" 
          :key="photo.id" 
          class="photo-item"
          @click="viewPhotoDetails(photo)"
        >
          <div class="photo-card">
            <div class="photo-image">
              <img :src="photo.url" :alt="photo.name" />
            </div>
            <div class="photo-info">
              <h3 class="photo-name" :title="photo.name">{{ photo.name }}</h3>
              <p class="photo-date">{{ formatDate(photo.createdAt) }}</p>
            </div>
            <div class="photo-actions">
              <el-button 
                type="text" 
                size="small"
                @click.stop="sharePhoto(photo)"
              >
                <el-icon><share /></el-icon> 分享
              </el-button>
              <el-button 
                type="text" 
                size="small"
                @click.stop="downloadPhoto(photo)"
              >
                <el-icon><download /></el-icon> 下载
              </el-button>
              <el-button 
                type="text" 
                size="small" 
                class="danger"
                @click.stop="confirmDelete(photo)"
              >
                <el-icon><delete /></el-icon> 删除
              </el-button>
            </div>
          </div>
        </div>
      </div>
      
      <el-dialog
        v-model="showShareDialog"
        title="分享照片"
        width="400px"
      >
        <div class="share-dialog-content">
          <p>分享链接：</p>
          <div class="share-link-container">
            <el-input v-model="shareLink" readonly />
            <el-button type="primary" @click="copyShareLink">复制</el-button>
          </div>
          <div class="share-options">
            <el-checkbox v-model="shareWithPassword">使用密码保护</el-checkbox>
            <el-input 
              v-if="shareWithPassword" 
              v-model="sharePassword" 
              placeholder="设置密码"
              type="password"
              show-password
              class="mt-10"
            />
          </div>
        </div>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="showShareDialog = false">取消</el-button>
            <el-button type="primary" @click="handleShare">确认分享</el-button>
          </span>
        </template>
      </el-dialog>
    </div>
  </app-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Share, Download, Delete } from '@element-plus/icons-vue';
import AppLayout from '../components/AppLayout.vue';
import { usePhotoStore } from '../store/photo';
import { useAuthStore } from '../store/auth';

const router = useRouter();
const photoStore = usePhotoStore();
const authStore = useAuthStore();
const isLoading = ref(true);
const sortBy = ref('newest');
const searchQuery = ref('');

// 分享相关状态
const showShareDialog = ref(false);
const shareLink = ref('');
const currentPhotoId = ref('');
const shareWithPassword = ref(false);
const sharePassword = ref('');

// 获取已排序和过滤后的照片
const filteredPhotos = computed(() => {
  let result = [...photoStore.userPhotos];
  
  // 过滤搜索结果
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(photo => 
      photo.name.toLowerCase().includes(query) || 
      (photo.description && photo.description.toLowerCase().includes(query))
    );
  }
  
  // 排序
  switch (sortBy.value) {
    case 'newest':
      result = result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'oldest':
      result = result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      break;
    case 'name':
      result = result.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  
  return result;
});

// 格式化日期
const formatDate = (date: Date | string) => {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// 查看照片详情
const viewPhotoDetails = (photo: any) => {
  router.push(`/photo/${photo.id}`);
};

// 分享照片
const sharePhoto = (photo: any) => {
  currentPhotoId.value = photo.id;
  shareLink.value = `${window.location.origin}/shared/${photo.id}`;
  showShareDialog.value = true;
};

// 复制分享链接
const copyShareLink = () => {
  navigator.clipboard.writeText(shareLink.value).then(() => {
    ElMessage.success('链接已复制到剪贴板');
  }).catch(() => {
    ElMessage.error('复制失败，请手动复制');
  });
};

// 处理分享
const handleShare = () => {
  // 这里可以添加实际的分享逻辑，例如保存分享设置到后端
  showShareDialog.value = false;
  ElMessage.success('照片已成功分享');
  
  // 重置状态
  shareWithPassword.value = false;
  sharePassword.value = '';
};

// 下载照片
const downloadPhoto = (photo: any) => {
  // 在实际应用中，这里可能需要向服务器请求下载链接
  const link = document.createElement('a');
  link.href = photo.url;
  link.download = photo.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  ElMessage.success('照片开始下载');
};

// 确认删除照片
const confirmDelete = (photo: any) => {
  ElMessageBox.confirm(
    '确定要删除这张照片吗？此操作不可撤销。',
    '删除确认',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    photoStore.deletePhoto(photo.id);
    ElMessage.success('照片已删除');
  }).catch(() => {
    // 用户取消删除
  });
};

// 清除搜索
const handleSearchClear = () => {
  searchQuery.value = '';
};

// 组件挂载时加载图片数据
onMounted(async () => {
  try {
    await photoStore.fetchUserPhotos(authStore.user?.id);
  } catch (error) {
    ElMessage.error('加载照片失败');
  } finally {
    isLoading.value = false;
  }
});
</script>

<style lang="scss" scoped>
.home-page {
  width: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  
  h1 {
    margin: 0;
    font-size: 28px;
    color: #303133;
  }
}

.header-actions {
  display: flex;
  gap: 12px;
  
  .sort-select {
    width: 140px;
  }
  
  .search-input {
    width: 240px;
  }
}

.loading-container {
  padding: 40px;
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

.photo-item {
  transition: transform 0.2s;
  cursor: pointer;
  
  &:hover {
    transform: translateY(-5px);
    
    .photo-actions {
      opacity: 1;
    }
  }
}

.photo-card {
  background-color: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.photo-image {
  height: 200px;
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s;
    
    &:hover {
      transform: scale(1.05);
    }
  }
}

.photo-info {
  padding: 16px;
  flex-grow: 1;
  
  .photo-name {
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .photo-date {
    margin: 0;
    color: #606266;
    font-size: 14px;
  }
}

.photo-actions {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px 16px;
  border-top: 1px solid #f1f1f1;
  opacity: 0.7;
  transition: opacity 0.2s;
  
  .danger {
    color: #f56c6c;
  }
}

.share-dialog-content {
  .share-link-container {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
  }
  
  .share-options {
    margin-top: 20px;
  }
}

.mt-10 {
  margin-top: 10px;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .header-actions {
    width: 100%;
    flex-direction: column;
    
    .sort-select,
    .search-input {
      width: 100%;
    }
  }
  
  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }
}
</style> 
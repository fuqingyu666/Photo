<!-- 
  照片上传页面组件
  实现照片上传功能，包括大文件上传、断点续传、暂停/继续、拖拽上传等特性
-->
<template>
  <app-layout>
    <div class="upload-page">
      <div class="page-header">
        <h1>上传照片</h1>
      </div>
      
      <!-- 上传区域容器 -->
      <div class="upload-container">
        <el-card class="upload-card">
          <!-- 拖放上传区域，支持文件拖放功能 -->
          <div
            class="upload-area"
            :class="{ 'is-dragging': isDragging }"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleFileDrop"
          >
            <!-- 未选择文件时显示的内容 -->
            <template v-if="!selectedFile">
              <el-icon :size="64" class="upload-icon"><UploadFilled /></el-icon>
              <h3>拖放图片到此处或</h3>
              <el-button type="primary" @click="triggerFileInput">选择图片</el-button>
              <!-- 隐藏的文件输入框，通过按钮触发 -->
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                class="file-input"
                @change="handleFileSelect"
              />
              <p class="upload-hint">支持JPG、PNG、GIF格式</p>
            </template>
            
            <!-- 选择文件后显示的内容 -->
            <template v-else>
              <div class="selected-file">
                <!-- 图片预览区域 -->
                <div class="preview-container">
                  <img :src="previewUrl" class="preview-image" alt="Preview" />
                </div>
                
                <!-- 文件信息和表单区域 -->
                <div class="file-info">
                  <div class="file-header">
                    <h3>{{ selectedFile.name }}</h3>
                    <el-button
                      type="danger"
                      size="small"
                      circle
                      @click="removeFile"
                      :disabled="isUploading"
                    >
                      <el-icon><Close /></el-icon>
                    </el-button>
                  </div>
                  
                  <p>{{ formatFileSize(selectedFile.size) }}</p>
                  
                  <!-- 照片元数据表单 -->
                  <el-form class="photo-form">
                    <el-form-item label="标题">
                      <el-input v-model="photoForm.title" :disabled="isUploading" />
                    </el-form-item>
                    
                    <el-form-item label="描述">
                      <el-input
                        v-model="photoForm.description"
                        type="textarea"
                        rows="3"
                        :disabled="isUploading"
                      />
                    </el-form-item>
                    
                    <!-- 隐私设置开关 -->
                    <el-form-item label="隐私设置">
                      <el-switch
                        v-model="photoForm.isPrivate"
                        :disabled="isUploading"
                        active-text="私密"
                        inactive-text="公开"
                      />
                      <div class="setting-hint">私密照片仅自己可见，不会显示在共享页面</div>
                    </el-form-item>
                    
                    <!-- 共享设置开关 -->
                    <el-form-item label="共享设置">
                      <el-switch
                        v-model="photoForm.isShared"
                        :disabled="isUploading || photoForm.isPrivate"
                        active-text="共享"
                        inactive-text="不共享"
                      />
                      <div class="setting-hint">共享照片将显示在共享页面供其他用户查看</div>
                    </el-form-item>
                  </el-form>
                  
                  <!-- 上传进度条区域 -->
                  <div v-if="isUploading" class="upload-progress">
                    <el-progress
                      :percentage="uploadProgress"
                      :status="uploadStatus === 'error' ? 'exception' : undefined"
                    />
                    <p>{{ uploadStatusText }}</p>
                  </div>
                  
                  <!-- 上传操作按钮 -->
                  <div class="upload-actions">
                    <el-button
                      type="primary"
                      @click="startUpload"
                      :disabled="!canUpload || isUploading"
                      :loading="isUploading && !isPaused"
                    >
                      {{ uploadButtonText }}
                    </el-button>
                    
                    <!-- 暂停/继续按钮（断点续传功能的关键UI元素） -->
                    <el-button 
                      v-if="isUploading" 
                      @click="togglePause" 
                      :type="isPaused ? 'primary' : 'default'"
                    >
                      {{ isPaused ? '继续' : '暂停' }}
                    </el-button>
                    
                    <el-button @click="removeFile" :disabled="isUploading && !isPaused">
                      取消
                    </el-button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </el-card>
      </div>
    </div>
  </app-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { UploadFilled, Close } from '@element-plus/icons-vue'
import AppLayout from '../components/AppLayout.vue'
import { useAuthStore } from '../store/auth'
import { usePhotoStore } from '../store/photo'
import { uploadFile } from '../api/upload'

// 路由和状态管理
const router = useRouter()
const authStore = useAuthStore()
const photoStore = usePhotoStore()

// 组件状态定义
const fileInputRef = ref<HTMLInputElement | null>(null)   // 文件输入框引用
const selectedFile = ref<File | null>(null)              // 已选文件
const previewUrl = ref('')                               // 预览图片URL
const photoForm = ref({
  title: '',                                            // 照片标题
  description: '',                                      // 照片描述
  isPrivate: false,                                     // 是否私密
  isShared: true                                        // 是否共享
})
const uploadStatus = ref('pending')                      // 上传状态：pending(等待), uploading(上传中), paused(已暂停), complete(完成), error(错误)
const isDragging = ref(false)                           // 是否正在拖拽文件
const isUploading = ref(false)                          // 是否正在上传
const isPaused = ref(false)                             // 是否已暂停
const uploadProgress = ref(0)                           // 上传进度百分比
const pauseSignal = ref({ paused: false })              // 暂停信号，用于传递给上传函数

/**
 * 计算属性：判断是否可以上传
 * 需要同时满足：已选择文件且标题不为空
 */
const canUpload = computed(() => {
  return selectedFile.value && photoForm.value.title.trim() !== ''
})

/**
 * 计算属性：上传状态文本
 * 根据当前上传状态返回对应的中文提示
 */
const uploadStatusText = computed(() => {
  switch(uploadStatus.value) {
    case 'pending': return '准备上传';
    case 'uploading': return `上传中... ${uploadProgress.value}%`;
    case 'paused': return '上传已暂停';
    case 'complete': return '上传完成';
    case 'error': return '上传失败';
    default: return '';
  }
})

/**
 * 计算属性：上传按钮文本
 * 根据上传状态显示不同的按钮文本
 */
const uploadButtonText = computed(() => {
  if (isUploading.value) {
    if (isPaused.value) {
      return '继续上传';
    }
    return '上传中...';
  }
  return '开始上传';
})

/**
 * 触发隐藏的文件输入框点击事件
 * 用于通过按钮打开文件选择对话框
 */
const triggerFileInput = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click()
  }
}

/**
 * 处理文件拖放事件
 * 当用户拖放文件到上传区域时调用
 * @param event 拖放事件对象
 */
const handleFileDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false

  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    const file = event.dataTransfer.files[0]
    // 验证是否为图片文件
    if (file.type.startsWith('image/')) {
      selectFile(file)
    } else {
      ElMessage.error('请选择图片文件')
    }
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = true
}

const handleDragLeave = () => {
  isDragging.value = false
}

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    selectFile(input.files[0])
  }
}

const selectFile = (file: File) => {
  selectedFile.value = file
  
  // 创建本地文件预览URL
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  previewUrl.value = URL.createObjectURL(file)
  
  // 自动设置标题为文件名，确保正确编码处理
  if (!photoForm.value.title) {
    const fileName = file.name.split('.').slice(0, -1).join('.')
    // 为显示目的，这里不使用编码，仅保存文件名作为标题
    photoForm.value.title = fileName
  }
}

const removeFile = () => {
  if (isUploading.value && !isPaused.value) return
  
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
  
  selectedFile.value = null
  photoForm.value.title = ''
  photoForm.value.description = ''
  uploadProgress.value = 0
  uploadStatus.value = 'pending'
  isUploading.value = false
  isPaused.value = false
}

const togglePause = () => {
  if (isPaused.value) {
    // 继续上传
    isPaused.value = false
    pauseSignal.value.paused = false
    uploadStatus.value = 'uploading'
    startUpload()
  } else {
    // 暂停上传
    isPaused.value = true
    pauseSignal.value.paused = true
    uploadStatus.value = 'paused'
  }
}

const startUpload = async () => {
  if (!selectedFile.value || !canUpload.value) return
  
  // 如果处于暂停状态并重新开始，则重置暂停标记
  if (isPaused.value) {
    isPaused.value = false
    pauseSignal.value.paused = false
  }
  
  try {
    isUploading.value = true
    uploadStatus.value = 'uploading'
    
    console.log('开始上传文件:', selectedFile.value.name)
    
    // 使用新的uploadFile函数处理分块上传
    const result = await uploadFile(
      selectedFile.value, 
      (progress) => {
        uploadProgress.value = progress
      },
      pauseSignal.value
    )
    
    // 检查上传结果
    if (!result.success) {
      if (isPaused.value) {
        console.log('Upload paused, can be resumed later')
        return
      }
      
      throw new Error('Upload failed')
    }
    
    console.log('上传成功:', result)
    uploadProgress.value = 100
    uploadStatus.value = 'complete'
    
    // 上传完成后的处理
    if (authStore.user) {
      // 尝试获取照片信息，可能通过不同的方式
      let photoInfo = null;
      
      if (result.photoId) {
        try {
          // 请求照片详情
          await photoStore.fetchPhotoById(result.photoId);
          photoInfo = photoStore.currentPhoto;
        } catch (err) {
          console.error('Error fetching photo details:', err);
        }
      }
      
      // 如果无法获取现有照片，则尝试创建一个新的
      if (!photoInfo) {
        photoStore.addPhoto({
          userId: authStore.user.id,
          username: authStore.user.username,
          userAvatar: authStore.user.avatar || '',
          title: encodeURIComponent(photoForm.value.title),
          description: photoForm.value.description ? encodeURIComponent(photoForm.value.description) : '',
          imageUrl: result.url || '', // 使用返回的URL
          isPrivate: photoForm.value.isPrivate,
          isShared: photoForm.value.isShared
        });
      }
      
      ElMessage({
        message: '照片上传成功',
        type: 'success',
        duration: 2000
      });
      
      // 短暂延迟后跳转，让用户看到成功提示
      setTimeout(() => {
        router.push('/home');
      }, 1000);
    }
  } catch (error) {
    console.error('上传失败:', error);
    
    // 显示更详细的错误信息
    let errorMessage = '上传失败，请重试';
    if (error.response?.data?.error) {
      errorMessage += `：${error.response.data.error}`;
    }
    
    ElMessage({
      message: errorMessage,
      type: 'error',
      duration: 5000
    });
    
    uploadStatus.value = 'error';
  } finally {
    // 只有未暂停时才结束上传状态
    if (!isPaused.value) {
      isUploading.value = false;
    }
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<style lang="scss" scoped>
.upload-page {
  width: 100%;
}

.page-header {
  margin-bottom: 24px;
  
  h1 {
    font-size: 28px;
    margin: 0;
    color: #303133;
  }
}

.upload-container {
  max-width: 800px;
  margin: 0 auto;
}

.upload-card {
  margin-bottom: 40px;
}

.upload-area {
  border: 2px dashed #d9d9d9;
  border-radius: 6px;
  padding: 40px;
  text-align: center;
  transition: all 0.3s;
  
  &.is-dragging {
    border-color: #409eff;
    background-color: rgba(64, 158, 255, 0.06);
  }
  
  h3 {
    margin: 20px 0;
    color: #606266;
  }
  
  .upload-icon {
    color: #c0c4cc;
  }
  
  .upload-hint {
    margin-top: 20px;
    color: #909399;
    font-size: 14px;
  }
}

.file-input {
  display: none;
}

.selected-file {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  text-align: left;
  
  .preview-container {
    width: 200px;
    height: 200px;
    overflow: hidden;
    border-radius: 4px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    
    .preview-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
  
  .file-info {
    flex: 1;
    
    .file-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      
      h3 {
        margin: 0;
        color: #303133;
      }
    }
    
    p {
      color: #606266;
      margin-bottom: 20px;
    }
    
    .photo-form {
      margin: 20px 0;
    }
    
    .setting-hint {
      font-size: 12px;
      color: #909399;
      margin-top: 5px;
    }
    
    .upload-progress {
      margin: 20px 0;
      
      p {
        margin-top: 8px;
        text-align: center;
      }
    }
    
    .upload-actions {
      display: flex;
      gap: 12px;
    }
  }
}

@media (max-width: 768px) {
  .selected-file {
    flex-direction: column;
    
    .preview-container {
      width: 100%;
      height: auto;
      aspect-ratio: 1/1;
    }
  }
}
</style> 
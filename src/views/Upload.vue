<template>
  <app-layout>
    <div class="upload-page">
      <div class="page-header">
        <h1>上传照片</h1>
      </div>
      
      <div class="upload-container">
        <el-card class="upload-card">
          <div
            class="upload-area"
            :class="{ 'is-dragging': isDragging }"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleFileDrop"
          >
            <template v-if="!selectedFile">
              <el-icon :size="64" class="upload-icon"><UploadFilled /></el-icon>
              <h3>拖放图片到此处或</h3>
              <el-button type="primary" @click="triggerFileInput">选择图片</el-button>
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                class="file-input"
                @change="handleFileSelect"
              />
              <p class="upload-hint">支持JPG、PNG、GIF格式，最大50MB</p>
            </template>
            
            <template v-else>
              <div class="selected-file">
                <div class="preview-container">
                  <img :src="previewUrl" class="preview-image" alt="Preview" />
                </div>
                
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
                    
                    <el-form-item label="隐私设置">
                      <el-switch
                        v-model="photoForm.isPrivate"
                        :disabled="isUploading"
                        active-text="私密"
                        inactive-text="公开"
                      />
                      <div class="setting-hint">私密照片仅自己可见，不会显示在共享页面</div>
                    </el-form-item>
                    
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
                  
                  <div v-if="isUploading" class="upload-progress">
                    <el-progress
                      :percentage="uploadProgress"
                      :status="uploadStatus === 'error' ? 'exception' : undefined"
                    />
                    <p>{{ uploadStatus === 'complete' ? '上传完成' : '上传中...' }}</p>
                  </div>
                  
                  <div class="upload-actions">
                    <el-button
                      type="primary"
                      @click="startUpload"
                      :disabled="!canUpload || isUploading"
                      :loading="isUploading"
                    >
                      开始上传
                    </el-button>
                    
                    <el-button @click="removeFile" :disabled="isUploading">
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
import { initUpload, uploadChunk, completeUpload } from '../api/upload'

const router = useRouter()
const authStore = useAuthStore()
const photoStore = usePhotoStore()

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const previewUrl = ref('')
const photoForm = ref({
  title: '',
  description: '',
  isPrivate: false,
  isShared: true
})
const chunks = ref<Blob[]>([])
const totalChunks = ref(0)
const currentChunk = ref(0)
const fileId = ref('')
const uploadStatus = ref('pending')
const isDragging = ref(false)
const isUploading = ref(false)
const uploadProgress = ref(0)

const canUpload = computed(() => {
  return selectedFile.value && photoForm.value.title.trim() !== ''
})

const triggerFileInput = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click()
  }
}

const handleFileDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false

  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    const file = event.dataTransfer.files[0]
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
  if (file.size > 50 * 1024 * 1024) {
    ElMessage.error('文件大小超过50MB限制')
    return
  }
  
  selectedFile.value = file
  
  // 创建本地文件预览URL
  const reader = new FileReader()
  reader.onload = (e) => {
    if (e.target?.result) {
      previewUrl.value = e.target.result as string
    }
  }
  reader.readAsDataURL(file)
  
  photoForm.value.title = file.name.split('.')[0] || '未命名'
  photoForm.value.description = ''
  
  prepareChunks(file)
}

const prepareChunks = (file: File) => {
  const chunkSize = 1024 * 1024
  totalChunks.value = Math.ceil(file.size / chunkSize)
  chunks.value = []
  
  for (let i = 0; i < totalChunks.value; i++) {
    const start = i * chunkSize
    const end = Math.min(file.size, start + chunkSize)
    chunks.value.push(file.slice(start, end))
  }
  
  currentChunk.value = 0
}

const removeFile = () => {
  selectedFile.value = null
  previewUrl.value = ''
  chunks.value = []
  totalChunks.value = 0
  currentChunk.value = 0
  uploadProgress.value = 0
  fileId.value = ''
  uploadStatus.value = 'pending'
}

const startUpload = async () => {
  if (!selectedFile.value || !canUpload.value) return
  
  try {
    isUploading.value = true
    uploadStatus.value = 'uploading'
    uploadProgress.value = 0
    
    console.log('开始上传文件:', selectedFile.value.name)
    
    // 创建表单并直接添加文件
    const formData = new FormData()
    formData.append('chunk', selectedFile.value) // 作为chunk字段上传
    
    // 发送上传请求
    const response = await initUpload(formData)
    console.log('上传成功:', response)
    
    // 文件已经上传完成，直接使用返回的信息
    uploadProgress.value = 100
    uploadStatus.value = 'complete'
    
    // 上传完成，添加到照片库
    if (authStore.user && response.photo) {
      const newPhoto = photoStore.addPhoto({
        userId: authStore.user.id,
        username: authStore.user.username,
        userAvatar: authStore.user.avatar || '',
        title: photoForm.value.title || response.photo.title,
        description: photoForm.value.description || '',
        imageUrl: response.url,
        isPrivate: photoForm.value.isPrivate,
        isShared: photoForm.value.isShared
      })
      
      ElMessage.success('照片上传成功')
      router.push('/home')
    }
  } catch (error) {
    console.error('上传失败:', error)
    if (error.response) {
      console.error('错误详情:', error.response.data)
    }
    ElMessage.error('上传失败，请重试')
    uploadStatus.value = 'error'
  } finally {
    isUploading.value = false
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
<template>
  <app-layout>
    <div class="upload-page">
      <div class="page-header">
        <h1>Upload Photo</h1>
      </div>
      
      <div class="upload-container">
        <el-card class="upload-card">
          <div class="upload-area" @click="triggerFileInput" @dragover.prevent @drop.prevent="handleFileDrop">
            <input 
              type="file" 
              ref="fileInputRef" 
              accept="image/*" 
              style="display: none" 
              @change="handleFileSelect"
            >
            
            <template v-if="!selectedFile">
              <el-icon class="upload-icon"><upload-filled /></el-icon>
              <p class="upload-text">Click or drag image to this area to upload</p>
              <p class="upload-hint">Support for a single image upload. Max size: 50MB</p>
            </template>
            
            <template v-else>
              <div class="selected-file">
                <div class="preview-image">
                  <img :src="previewUrl" alt="Preview">
                </div>
                <div class="file-info">
                  <h3>{{ selectedFile.name }}</h3>
                  <p>{{ formatFileSize(selectedFile.size) }}</p>
                </div>
                <el-button type="danger" circle @click.stop="removeFile">
                  <el-icon><close /></el-icon>
                </el-button>
              </div>
            </template>
          </div>
          
          <div v-if="uploadTask" class="upload-progress">
            <div class="progress-header">
              <span>Upload Progress</span>
              <span>{{ Math.round(uploadTask.progress) }}%</span>
            </div>
            <el-progress :percentage="uploadTask.progress" :status="uploadStatus" />
            
            <div class="upload-stats">
              <p>Chunks: {{ uploadTask.uploadedChunks }}/{{ uploadTask.chunks.length }}</p>
              <p>Status: {{ uploadTask.status }}</p>
            </div>
            
            <div class="upload-actions">
              <el-button 
                v-if="uploadTask.status === 'pending' || uploadTask.status === 'paused'" 
                type="primary" 
                @click="startUpload"
                :loading="uploadTask.status === 'uploading'"
              >
                {{ uploadTask.status === 'paused' ? 'Resume' : 'Start Upload' }}
              </el-button>
              
              <el-button 
                v-if="uploadTask.status === 'uploading'" 
                type="warning" 
                @click="pauseUpload"
              >
                Pause
              </el-button>
              
              <el-button 
                v-if="uploadTask.status === 'completed'" 
                type="success" 
                @click="finishUpload"
              >
                Finish
              </el-button>
            </div>
          </div>
          
          <el-divider v-if="selectedFile && !uploadTask" />
          
          <div v-if="selectedFile && !uploadTask" class="photo-form">
            <el-form :model="photoForm" label-position="top">
              <el-form-item label="Title" required>
                <el-input v-model="photoForm.title" placeholder="Enter a title for your photo" />
              </el-form-item>
              
              <el-form-item label="Description" required>
                <el-input 
                  v-model="photoForm.description" 
                  type="textarea" 
                  :rows="4" 
                  placeholder="Describe your photo"
                />
              </el-form-item>
              
              <el-form-item>
                <el-button type="primary" @click="prepareUpload" :disabled="!canUpload">
                  Upload Photo
                </el-button>
              </el-form-item>
            </el-form>
          </div>
          
          <div v-if="savedTasks.length > 0" class="saved-uploads">
            <h3>Saved Uploads</h3>
            <p>You have previously paused uploads. Would you like to resume?</p>
            
            <div class="saved-tasks-list">
              <el-card 
                v-for="task in savedTasks" 
                :key="task.fileId" 
                class="saved-task-item"
                shadow="hover"
              >
                <div class="saved-task-info">
                  <h4>{{ task.fileName }}</h4>
                  <p>{{ formatFileSize(task.fileSize) }} | {{ formatDate(task.createTime) }}</p>
                  <p>Progress: {{ Math.round(task.progress) }}%</p>
                </div>
                
                <div class="saved-task-actions">
                  <el-button type="primary" size="small" @click="resumeSavedTask(task.fileId)">
                    Resume
                  </el-button>
                  <el-button type="danger" size="small" @click="deleteSavedTask(task.fileId)">
                    Delete
                  </el-button>
                </div>
              </el-card>
            </div>
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
import { 
  createUploadTask, 
  startUpload, 
  pauseUpload as pauseUploadTask,
  saveUploadProgress,
  getSavedUploadTasks,
  clearSavedUploadTask,
  UploadTask
} from '../utils/file-upload'

const router = useRouter()
const authStore = useAuthStore()
const photoStore = usePhotoStore()

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const previewUrl = ref('')
const uploadTask = ref<UploadTask | null>(null)
const savedTasks = ref<Partial<UploadTask>[]>([])

// Photo form data
const photoForm = ref({
  title: '',
  description: ''
})

// Check if can upload
const canUpload = computed(() => {
  return selectedFile.value && photoForm.value.title && photoForm.value.description
})

// Get upload status
const uploadStatus = computed(() => {
  if (!uploadTask.value) return ''
  
  switch (uploadTask.value.status) {
    case 'completed':
      return 'success'
    case 'error':
      return 'exception'
    case 'paused':
      return 'warning'
    default:
      return ''
  }
})

// Load saved upload tasks
onMounted(() => {
  loadSavedTasks()
})

// Load saved tasks from localStorage
const loadSavedTasks = () => {
  savedTasks.value = getSavedUploadTasks()
}

// Trigger file input click
const triggerFileInput = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click()
  }
}

// Handle file drop
const handleFileDrop = (event: DragEvent) => {
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    const file = event.dataTransfer.files[0]
    if (file.type.startsWith('image/')) {
      selectFile(file)
    } else {
      ElMessage.error('Please select an image file')
    }
  }
}

// Handle file select from input
const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    selectFile(input.files[0])
  }
}

// Select file and create preview
const selectFile = (file: File) => {
  // Check file size (max 50MB)
  if (file.size > 50 * 1024 * 1024) {
    ElMessage.error('File size exceeds the 50MB limit')
    return
  }
  
  selectedFile.value = file
  
  // Create preview URL
  const reader = new FileReader()
  reader.onload = (e) => {
    previewUrl.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
  
  // Reset form and task
  photoForm.value.title = file.name.split('.')[0] || 'Untitled'
  photoForm.value.description = ''
  uploadTask.value = null
}

// Remove selected file
const removeFile = () => {
  selectedFile.value = null
  previewUrl.value = ''
  uploadTask.value = null
}

// Prepare upload task
const prepareUpload = async () => {
  if (!selectedFile.value || !canUpload.value) return
  
  try {
    ElMessage.info('Preparing file for upload, please wait...')
    uploadTask.value = await createUploadTask(selectedFile.value)
    ElMessage.success('File prepared for upload')
  } catch (error) {
    ElMessage.error('Failed to prepare file for upload')
    console.error(error)
  }
}

// Start upload
const startUpload = async () => {
  if (!uploadTask.value) return
  
  try {
    await startUpload(uploadTask.value, (progress) => {
      // Progress callback
      if (uploadTask.value && uploadTask.value.status === 'paused') {
        saveUploadProgress(uploadTask.value)
      }
    })
    
    if (uploadTask.value.status === 'completed') {
      ElMessage.success('Upload completed successfully')
    }
  } catch (error) {
    ElMessage.error('Upload failed')
    console.error(error)
  }
}

// Pause upload
const pauseUpload = () => {
  if (!uploadTask.value) return
  
  pauseUploadTask(uploadTask.value)
  saveUploadProgress(uploadTask.value)
  ElMessage.warning('Upload paused. You can resume later.')
  loadSavedTasks()
}

// Finish upload and save photo
const finishUpload = () => {
  if (!uploadTask.value || !authStore.user) return
  
  // In a real app, we would send the chunks to the server and get back the URL
  // For this demo, we'll use the preview URL
  const newPhoto = photoStore.addPhoto({
    userId: authStore.user.id,
    username: authStore.user.username,
    userAvatar: authStore.user.avatar || '',
    title: photoForm.value.title,
    description: photoForm.value.description,
    imageUrl: previewUrl.value
  })
  
  // Clear the upload task
  if (uploadTask.value) {
    clearSavedUploadTask(uploadTask.value.fileId)
  }
  
  ElMessage.success('Photo added successfully')
  router.push(`/detail/${newPhoto.id}`)
}

// Resume a saved task
const resumeSavedTask = (fileId: string) => {
  const task = savedTasks.value.find(task => task.fileId === fileId)
  if (!task) return
  
  ElMessage.info('This is a mock implementation. In a real app, we would resume the upload.')
  
  // In a real app, we would recreate the upload task and resume it
  // For this demo, we'll just remove it from saved tasks
  clearSavedUploadTask(fileId)
  loadSavedTasks()
}

// Delete a saved task
const deleteSavedTask = (fileId: string) => {
  clearSavedUploadTask(fileId)
  loadSavedTasks()
  ElMessage.success('Saved upload deleted')
}

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Format date
const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
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
  cursor: pointer;
  transition: border-color 0.3s;
  
  &:hover {
    border-color: #409EFF;
  }
}

.upload-icon {
  font-size: 48px;
  color: #c0c4cc;
  margin-bottom: 16px;
}

.upload-text {
  font-size: 16px;
  color: #606266;
  margin-bottom: 8px;
}

.upload-hint {
  font-size: 14px;
  color: #909399;
}

.selected-file {
  display: flex;
  align-items: center;
  
  .preview-image {
    width: 100px;
    height: 100px;
    overflow: hidden;
    border-radius: 4px;
    margin-right: 16px;
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
  
  .file-info {
    flex: 1;
    text-align: left;
    
    h3 {
      margin: 0 0 8px;
      font-size: 16px;
    }
    
    p {
      margin: 0;
      color: #909399;
      font-size: 14px;
    }
  }
}

.upload-progress {
  margin-top: 24px;
  
  .progress-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 14px;
  }
  
  .upload-stats {
    margin-top: 16px;
    display: flex;
    justify-content: space-between;
    font-size: 14px;
    color: #606266;
    
    p {
      margin: 0;
    }
  }
  
  .upload-actions {
    margin-top: 16px;
    display: flex;
    justify-content: center;
    gap: 16px;
  }
}

.photo-form {
  margin-top: 24px;
}

.saved-uploads {
  margin-top: 40px;
  
  h3 {
    font-size: 18px;
    margin-bottom: 8px;
  }
  
  p {
    color: #606266;
    margin-bottom: 16px;
  }
  
  .saved-tasks-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }
  
  .saved-task-item {
    display: flex;
    flex-direction: column;
    
    .saved-task-info {
      flex: 1;
      
      h4 {
        margin: 0 0 8px;
        font-size: 16px;
      }
      
      p {
        margin: 0 0 8px;
        color: #909399;
        font-size: 14px;
      }
    }
    
    .saved-task-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
  }
}

@media (max-width: 768px) {
  .upload-area {
    padding: 20px;
  }
  
  .selected-file {
    flex-direction: column;
    
    .preview-image {
      margin-right: 0;
      margin-bottom: 16px;
    }
    
    .file-info {
      text-align: center;
      margin-bottom: 16px;
    }
  }
  
  .upload-stats {
    flex-direction: column;
    gap: 8px;
  }
}
</style> 
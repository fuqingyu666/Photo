<template>
  <div class="photo-comments">
    <h3 class="comments-title">评论 ({{ totalCommentCount }})</h3>
    
    <!-- 添加评论 -->
    <div class="comment-form">
      <el-input
        v-model="newComment"
        placeholder="添加评论..."
        type="textarea"
        :rows="2"
        :maxlength="500"
        show-word-limit
        resize="none"
      />
      <div class="form-actions">
        <el-button 
          type="primary" 
          @click="postComment" 
          :disabled="!newComment.trim() || commentStore.loading"
          :loading="submitting"
        >
          发布
        </el-button>
      </div>
    </div>
    
    <!-- 评论列表 -->
    <div v-if="commentStore.loading && !submitting" class="loading-comments">
      <el-skeleton :rows="3" animated />
    </div>
    
    <div v-else-if="commentStore.comments.length === 0" class="no-comments">
      <p>暂无评论，快来发表第一条评论吧！</p>
    </div>
    
    <div v-else class="comments-list">
      <div 
        v-for="comment in commentStore.comments" 
        :key="comment.id"
        class="comment-item"
      >
        <div class="comment-avatar">
          <el-avatar :size="40">
            {{ comment.username ? comment.username.charAt(0).toUpperCase() : '?' }}
          </el-avatar>
        </div>
        <div class="comment-content">
          <div class="comment-header">
            <span class="username">{{ comment.username || '用户' }}</span>
            <span class="comment-time">{{ formatDate(comment.created_at) }}</span>
          </div>
          <div class="comment-text">{{ comment.content }}</div>
        </div>
        <div v-if="canDelete(comment)" class="comment-actions">
          <el-button 
            text
            type="danger" 
            @click="deleteComment(comment.id)"
            :disabled="deleting === comment.id"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Delete } from '@element-plus/icons-vue';
import { useCommentStore } from '../store/comment';
import { useAuthStore } from '../store/auth';
import { useSocketStore } from '../store/socket';

// Props
const props = defineProps<{
  photoId: string;
}>();

// Stores
const commentStore = useCommentStore();
const authStore = useAuthStore();
const socketStore = useSocketStore();
const route = useRoute();

// State
const newComment = ref<string>('');
const submitting = ref<boolean>(false);
const deleting = ref<string | null>(null);

// Computed properties
const totalCommentCount = computed(() => {
  return commentStore.comments.length;
});

// Methods
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const postComment = async () => {
  if (!newComment.value.trim()) return;
  
  submitting.value = true;
  
  try {
    const success = await commentStore.postComment(props.photoId, newComment.value);
    if (success) {
      newComment.value = '';
    } else {
      ElMessage.error('评论发布失败，请重试');
    }
  } catch (err) {
    console.error('Error posting comment:', err);
    ElMessage.error('评论发布失败，请重试');
  } finally {
    submitting.value = false;
  }
};

const deleteComment = async (commentId: string) => {
  deleting.value = commentId;
  
  try {
    const success = await commentStore.removeUserComment(props.photoId, commentId);
    if (!success) {
      ElMessage.error('删除评论失败，请重试');
    }
  } catch (err) {
    console.error('Error deleting comment:', err);
    ElMessage.error('删除评论失败，请重试');
  } finally {
    deleting.value = null;
  }
};

const canDelete = (comment: any) => {
  // 游客评论（临时评论）允许删除
  if (comment.user_id === 'guest') {
    return true;
  }
  // 已登录用户只能删除自己的评论
  return authStore.user && comment.user_id === authStore.user.id;
};

// Lifecycle hooks
onMounted(async () => {
  // Connect to WebSocket
  await socketStore.ensureConnection();
  
  // Setup socket listeners
  commentStore.connectToPhotoRoom(props.photoId);
  
  // Load comments
  await commentStore.loadComments(props.photoId);
});

onUnmounted(() => {
  // Remove socket listeners
  commentStore.disconnectFromPhotoRoom();
});
</script>

<style scoped>
.photo-comments {
  margin-top: 2rem;
}

.comments-title {
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

.comment-form {
  margin-bottom: 2rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.comment-item {
  display: flex;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

.comment-avatar {
  flex-shrink: 0;
}

.comment-content {
  flex-grow: 1;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.username {
  font-weight: 600;
}

.comment-time {
  color: #999;
  font-size: 0.9em;
}

.comment-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.comment-actions {
  flex-shrink: 0;
  align-self: flex-start;
}

.no-comments {
  padding: 2rem;
  text-align: center;
  color: #999;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.loading-comments {
  padding: 1rem 0;
}
</style> 
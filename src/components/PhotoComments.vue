<!-- 
  照片评论组件
  显示照片评论列表，允许用户添加和删除评论，支持实时更新
-->
<template>
  <div class="photo-comments">
    <h3 class="comments-title">评论 ({{ totalCommentCount }})</h3>
    
    <!-- 添加评论的表单区域 -->
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
    
    <!-- 评论加载中显示骨架屏 -->
    <div v-if="commentStore.loading && !submitting" class="loading-comments">
      <el-skeleton :rows="3" animated />
    </div>
    
    <!-- 无评论时显示提示信息 -->
    <div v-else-if="commentStore.comments.length === 0" class="no-comments">
      <p>暂无评论，快来发表第一条评论吧！</p>
    </div>
    
    <!-- 评论列表 -->
    <div v-else class="comments-list">
      <div 
        v-for="comment in commentStore.comments" 
        :key="comment.id"
        class="comment-item"
      >
        <!-- 评论用户头像 -->
        <div class="comment-avatar">
          <el-avatar :size="40">
            {{ comment.username ? comment.username.charAt(0).toUpperCase() : '?' }}
          </el-avatar>
        </div>
        <!-- 评论内容区域 -->
        <div class="comment-content">
          <div class="comment-header">
            <span class="username">{{ comment.username || '用户' }}</span>
            <span class="comment-time">{{ formatDate(comment.created_at) }}</span>
          </div>
          <div class="comment-text">{{ comment.content }}</div>
        </div>
        <!-- 评论操作区域 - 仅显示给评论作者 -->
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

// 组件属性，定义需要传入的照片ID
const props = defineProps<{
  photoId: string;  // 当前照片的唯一ID，用于加载和发布相关评论
}>();

// 引入需要的状态管理store
const commentStore = useCommentStore();  // 评论相关的状态和操作
const authStore = useAuthStore();        // 用户认证状态，用于确定当前用户
const socketStore = useSocketStore();    // WebSocket管理，用于实时通信
const route = useRoute();                // 当前路由信息

// 本地状态管理
const newComment = ref<string>('');      // 新评论输入内容
const submitting = ref<boolean>(false);  // 评论提交状态
const deleting = ref<string | null>(null); // 正在删除的评论ID

// 计算属性：计算评论总数
const totalCommentCount = computed(() => {
  return commentStore.comments.length;
});

/**
 * 格式化日期显示
 * 将ISO日期字符串转换为本地化的日期时间格式
 * @param dateString ISO日期字符串
 * @returns 格式化后的日期字符串
 */
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

/**
 * 发布新评论
 * 将用户输入的评论内容提交到服务器，并清空输入框
 */
const postComment = async () => {
  // 如果评论内容为空，不执行操作
  if (!newComment.value.trim()) return;
  
  submitting.value = true;
  
  try {
    // 调用评论store的方法发布评论
    const success = await commentStore.postComment(props.photoId, newComment.value);
    if (success) {
      // 发布成功，清空输入框
      newComment.value = '';
    } else {
      // 发布失败，显示错误提示
      ElMessage.error('评论发布失败，请重试');
    }
  } catch (err) {
    console.error('Error posting comment:', err);
    ElMessage.error('评论发布失败，请重试');
  } finally {
    // 无论成功失败，都结束提交状态
    submitting.value = false;
  }
};

/**
 * 删除评论
 * 从服务器删除指定的评论
 * @param commentId 要删除的评论ID
 */
const deleteComment = async (commentId: string) => {
  // 设置正在删除的评论ID，用于禁用删除按钮
  deleting.value = commentId;
  
  try {
    // 调用评论store的方法删除评论
    const success = await commentStore.removeUserComment(props.photoId, commentId);
    if (!success) {
      // 删除失败，显示错误提示
      ElMessage.error('删除评论失败，请重试');
    }
  } catch (err) {
    console.error('Error deleting comment:', err);
    ElMessage.error('删除评论失败，请重试');
  } finally {
    // 无论成功失败，都结束删除状态
    deleting.value = null;
  }
};

/**
 * 检查用户是否可以删除评论
 * 判断条件：1. 游客评论可以直接删除 2. 登录用户只能删除自己的评论
 * @param comment 评论对象
 * @returns 是否可以删除
 */
const canDelete = (comment: any) => {
  // 游客评论（临时评论）允许删除
  if (comment.user_id === 'guest') {
    return true;
  }
  // 已登录用户只能删除自己的评论
  return authStore.user && comment.user_id === authStore.user.id;
};

// 组件挂载时执行的操作
onMounted(async () => {
  // 确保WebSocket连接已建立
  await socketStore.ensureConnection();
  
  // 设置WebSocket监听器，实时接收新评论
  commentStore.connectToPhotoRoom(props.photoId);
  
  // 加载当前照片的所有评论
  await commentStore.loadComments(props.photoId);
});

// 组件卸载前执行的清理操作
onUnmounted(() => {
  // 移除WebSocket监听器，避免内存泄漏
  commentStore.disconnectFromPhotoRoom();
});
</script>

<style scoped>
/* 评论区整体样式 */
.photo-comments {
  margin-top: 2rem;
}

/* 评论标题样式 */
.comments-title {
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

/* 评论表单样式 */
.comment-form {
  margin-bottom: 2rem;
}

/* 表单按钮区域样式 */
.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

/* 评论列表样式 */
.comments-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 单条评论样式 */
.comment-item {
  display: flex;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

/* 评论头像样式 */
.comment-avatar {
  flex-shrink: 0;
}

/* 评论内容区域样式 */
.comment-content {
  flex-grow: 1;
}

/* 评论头部信息样式 */
.comment-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

/* 用户名样式 */
.username {
  font-weight: 600;
}

/* 评论时间样式 */
.comment-time {
  color: #999;
  font-size: 0.9em;
}

/* 评论文本样式 */
.comment-text {
  white-space: pre-wrap;
  word-break: break-word;
}

/* 评论操作按钮样式 */
.comment-actions {
  flex-shrink: 0;
  align-self: flex-start;
}

/* 无评论提示样式 */
.no-comments {
  padding: 2rem;
  text-align: center;
  color: #999;
  background-color: #f8f9fa;
  border-radius: 4px;
}

/* 加载中的骨架屏样式 */
.loading-comments {
  padding: 1rem 0;
}
</style> 
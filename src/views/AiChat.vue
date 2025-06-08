<template>
  <app-layout>
    <div class="ai-chat-page">
      <div class="page-header">
        <h1>相册AI助手</h1>
      </div>
      
      <div class="ai-chat-container">
        <div class="chat-messages-container">
          <div ref="messagesRef" class="chat-messages" @scroll="handleScroll">
            <template v-if="isLoadingHistory">
              <div v-for="i in 3" :key="`skeleton-${i}`" class="message-skeleton">
                <div class="skeleton-avatar"></div>
                <div class="skeleton-content">
                  <div class="skeleton-text"></div>
                  <div class="skeleton-text"></div>
                </div>
              </div>
            </template>

            <template v-else-if="messages.length === 0">
              <div class="empty-messages">
                <el-icon class="empty-icon"><ChatLineRound /></el-icon>
                <h3>欢迎使用相册AI助手</h3>
                <p>您可以询问任何关于摄影或照片的问题！</p>
                <div class="suggestion-chips">
                  <div 
                    v-for="(suggestion, index) in messageSuggestions" 
                    :key="index" 
                    class="suggestion-chip"
                    @click="sendMessage(suggestion)"
                  >
                    {{ suggestion }}
                  </div>
                </div>
              </div>
            </template>

            <template v-else>
              <div 
                v-for="(msg, index) in messages" 
                :key="msg.id" 
                class="message"
                :class="{ 
                  'user-message': msg.role === 'user', 
                  'ai-message': msg.role === 'assistant',
                  'first-of-group': isFirstOfGroup(index),
                  'last-of-group': isLastOfGroup(index)
                }"
              >
                <template v-if="isFirstOfGroup(index)">
                  <div class="avatar">
                    <el-avatar 
                      :size="36" 
                      :src="msg.role === 'user' ? userAvatar : aiAvatar"
                      :icon="msg.role === 'user' ? UserFilled : Service"
                    />
                  </div>
                </template>
                <template v-else>
                  <div class="avatar-placeholder"></div>
                </template>

                <div class="message-content">
                  <div class="message-text" v-html="formatMessage(msg.content)"></div>
                  <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
                </div>
              </div>

              <div v-if="isTyping" class="message ai-message typing-indicator">
                <div class="avatar">
                  <el-avatar :size="36" :icon="Service" />
                </div>
                <div class="message-content">
                  <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
        
        <div class="chat-input-area">
          <div class="suggestions" v-if="!inputMessage && showSuggestions">
            <div 
              v-for="(suggestion, index) in quickSuggestions" 
              :key="index" 
              class="suggestion"
              @click="sendMessage(suggestion)"
            >
              {{ suggestion }}
            </div>
          </div>

          <div class="input-container">
            <el-input
              v-model="inputMessage"
              type="textarea"
              :rows="1"
              :placeholder="isTyping ? 'AI正在回复...' : '输入您想问的关于照片的问题...'"
              resize="none"
              :disabled="isTyping"
              @keydown.enter.exact.prevent="sendMessage(inputMessage)"
              ref="inputRef"
              autosize
            />
            
            <div class="input-actions">
              <el-tooltip content="清除对话" placement="top">
                <el-button
                  circle
                  size="small"
                  :icon="Delete"
                  @click="clearConversation"
                  :disabled="messages.length === 0 || isTyping"
                />
              </el-tooltip>
              
              <el-button
                type="primary"
                circle
                size="small"
                :icon="isTyping ? CircleClose : Position"
                :loading="isSending && !isTyping"
                @click="isTyping ? cancelStreaming() : sendMessage(inputMessage)"
                :disabled="!inputMessage && !isTyping"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </app-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed } from 'vue'
import { useAiChatStore, ChatMessage } from '../store/ai-chat'
import { useAuthStore } from '../store/auth'
import { ChatLineRound, Position, Service, CircleClose, Delete, UserFilled } from '@element-plus/icons-vue'
import { useWebSocketStatus } from '../hooks/useWebSocketStatus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import AppLayout from '../components/AppLayout.vue'
import debounce from 'lodash/debounce'

// Stores
const aiChatStore = useAiChatStore()
const authStore = useAuthStore()

// WebSocket status
const { isConnected } = useWebSocketStatus()

// Chat state
const inputMessage = ref('')
const inputRef = ref<HTMLElement | null>(null)
const messagesRef = ref<HTMLElement | null>(null)
const isTyping = ref(false)
const isSending = ref(false)
const isLoadingHistory = ref(false)
const showSuggestions = ref(true)
const userAvatar = computed(() => authStore.user?.avatar || '')
const aiAvatar = ref('/ai-avatar.png')
const scrolledToBottom = ref(true)
const controller = ref<AbortController | null>(null)

// Get messages from store
const messages = computed(() => aiChatStore.messages)

// Message suggestions for empty state
const messageSuggestions = [
  "如何拍摄好看的风景照？",
  "如何提高我的人像摄影技巧？",
  "夜景摄影有哪些技巧？",
  "如何运用三分法则？",
  "拍摄日落时应该使用什么相机设置？"
]

// Quick suggestions
const quickSuggestions = [
  "如何提高我的照片质量？",
  "什么是光圈？",
  "人像摄影的最佳设置"
]

// Format message with markdown and sanitize HTML
const formatMessage = (content: string) => {
  // Convert markdown to HTML
  const html = marked(content)
  
  // Sanitize HTML to prevent XSS
  const sanitizedHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'a', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel']
  })
  
  return sanitizedHtml
}

// Format timestamp
const formatTime = (timestamp: Date) => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Check if message is first in a group
const isFirstOfGroup = (index: number) => {
  if (index === 0) return true
  return messages.value[index].role !== messages.value[index - 1].role
}

// Check if message is last in a group
const isLastOfGroup = (index: number) => {
  if (index === messages.value.length - 1) return true
  return messages.value[index].role !== messages.value[index + 1].role
}

// Handle scroll
const handleScroll = debounce(() => {
  if (!messagesRef.value) return
  
  const { scrollTop, scrollHeight, clientHeight } = messagesRef.value
  scrolledToBottom.value = Math.abs(scrollHeight - scrollTop - clientHeight) < 50
}, 100)

// Scroll to bottom of messages
const scrollToBottom = async () => {
  await nextTick()
  if (!messagesRef.value) return
  
  if (scrolledToBottom.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

// Send a message
const sendMessage = async (message: string) => {
  if (!message.trim() && !isTyping.value) return
  
  if (isTyping.value) {
    cancelStreaming()
    return
  }
  
  try {
    inputMessage.value = ''
    showSuggestions.value = false
    isSending.value = true
    isTyping.value = true
    
    // 添加用户消息
    await aiChatStore.addUserMessage(message)
    
    // 创建一个新的 AbortController 来控制流
    controller.value = new AbortController()
    
    // 使用流式响应
    const result = await aiChatStore.sendMessage(message, {
      onStream: (chunk: string) => {
        // 流式更新不需要做任何事，因为store会自动更新消息
        scrollToBottom()
      },
      signal: controller.value.signal
    })
    
    if (!result) {
      console.error('AI没有返回有效回复')
      ElMessage.error('AI响应失败，请重试')
    }
    
    // 自动滚动到底部
    await nextTick()
    scrollToBottom()
    
  } catch (error) {
    console.error('发送消息错误:', error)
    ElMessage.error('发送消息失败，请重试')
  } finally {
    isSending.value = false
    isTyping.value = false
    controller.value = null
    
    // 聚焦输入框
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
}

// Cancel streaming response
const cancelStreaming = () => {
  if (controller.value) {
    controller.value.abort();
    controller.value = null;
    console.log('用户取消了AI响应');
    isTyping.value = false;
    
    // 给用户反馈
    ElMessage.info('已停止AI响应');
    
    // 聚焦输入框
    nextTick(() => {
      inputRef.value?.focus();
    });
  }
};

// Clear conversation
const clearConversation = () => {
  ElMessageBox.confirm(
    '确定要清除所有对话历史吗？这个操作不可撤销。',
    '清除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    aiChatStore.clearMessages();
    ElMessage.success('对话历史已清除');
  }).catch(() => {
    // 用户取消操作
  });
};

// Focus the input when component is mounted
onMounted(async () => {
  // Focus input
  nextTick(() => {
    inputRef.value?.focus()
  })
  
  // Load message history
  isLoadingHistory.value = true
  try {
    await aiChatStore.loadMessages()
    
    // Scroll to bottom after loading history
    scrollToBottom()
  } catch (error) {
    console.error('加载历史消息错误:', error)
    ElMessage.error('加载聊天历史失败')
  } finally {
    isLoadingHistory.value = false
  }
  
  // Add scrolling event listener
  if (messagesRef.value) {
    messagesRef.value.addEventListener('scroll', handleScroll)
  }
})

// Watch for new messages to scroll
watch(
  () => messages.value.length,
  () => {
    scrollToBottom()
  }
)

// Clean up
onBeforeUnmount(() => {
  if (messagesRef.value) {
    messagesRef.value.removeEventListener('scroll', handleScroll)
  }
  
  // Cancel any ongoing stream
  if (controller.value) {
    controller.value.abort()
  }
})
</script>

<style lang="scss" scoped>
.ai-chat-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 64px);
}

.page-header {
  padding: 0 20px;
  
  h1 {
    font-size: 24px;
    margin: 0;
    padding: 16px 0;
  }
}

.ai-chat-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin: 0 20px 20px;
  overflow: hidden;
}

.chat-messages-container {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.chat-messages {
  padding: 20px;
  overflow-y: auto;
  max-height: 100%;
  height: 100%;
  scrollbar-width: thin;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }
}

.message {
  display: flex;
  margin-bottom: 4px;
  
  &.first-of-group {
    margin-top: 16px;
  }
  
  &.last-of-group {
    margin-bottom: 16px;
  }
  
  &.user-message .message-content {
    background-color: #e6f7ff;
    border-radius: 12px 12px 2px 12px;
  }
  
  &.ai-message .message-content {
    background-color: white;
    border-radius: 12px 12px 12px 2px;
  }
}

.avatar {
  width: 44px;
  height: 36px;
  margin-right: 8px;
  flex-shrink: 0;
}

.avatar-placeholder {
  width: 44px;
  margin-right: 8px;
  flex-shrink: 0;
}

.message-content {
  padding: 12px 16px;
  border-radius: 12px;
  max-width: calc(100% - 60px);
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.message-text {
  white-space: pre-wrap;
  line-height: 1.5;
  
  :deep(code) {
    background-color: rgba(0,0,0,0.05);
    padding: 2px 4px;
    border-radius: 4px;
    font-family: monospace;
  }
  
  :deep(pre) {
    background-color: #f1f1f1;
    padding: 8px;
    border-radius: 4px;
    overflow-x: auto;
  }
  
  :deep(a) {
    color: #409EFF;
  }
}

.message-time {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  text-align: right;
}

.chat-input-area {
  padding: 16px;
  border-top: 1px solid #eee;
  background-color: white;
}

.input-container {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  
  .el-textarea {
    flex: 1;
  }
}

.input-actions {
  display: flex;
  gap: 8px;
}

.empty-messages {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 80%;
  text-align: center;
  
  .empty-icon {
    font-size: 48px;
    color: #409EFF;
    margin-bottom: 16px;
  }
  
  h3 {
    font-size: 20px;
    margin-bottom: 8px;
  }
  
  p {
    color: #666;
    margin-bottom: 24px;
  }
}

.suggestion-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  max-width: 600px;
}

.suggestion-chip {
  background-color: white;
  padding: 8px 16px;
  border-radius: 16px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  border: 1px solid #eee;
  
  &:hover {
    background-color: #f0f9ff;
  }
}

.suggestions {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  
  &::-webkit-scrollbar {
    height: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 2px;
  }
}

.suggestion {
  background-color: #f0f9ff;
  padding: 6px 12px;
  border-radius: 16px;
  white-space: nowrap;
  cursor: pointer;
  font-size: 13px;
  
  &:hover {
    background-color: #e6f7ff;
  }
}

// Typing indicator
.typing-indicator {
  .typing-dots {
    display: flex;
    align-items: center;
    
    span {
      height: 8px;
      width: 8px;
      margin: 0 4px;
      background-color: #c1c1c1;
      border-radius: 50%;
      display: inline-block;
      animation: bounce 1.3s linear infinite;
      
      &:nth-child(2) {
        animation-delay: 0.15s;
      }
      
      &:nth-child(3) {
        animation-delay: 0.3s;
      }
    }
  }
}

// Message skeleton
.message-skeleton {
  display: flex;
  margin-bottom: 24px;
  
  .skeleton-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background-color: #eee;
    margin-right: 12px;
  }
  
  .skeleton-content {
    flex: 1;
    max-width: 70%;
    
    .skeleton-text {
      height: 12px;
      background-color: #eee;
      margin-bottom: 8px;
      border-radius: 4px;
      
      &:nth-child(1) {
        width: 80%;
      }
      
      &:nth-child(2) {
        width: 60%;
      }
    }
  }
}

@keyframes bounce {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-4px);
  }
}

@media (max-width: 768px) {
  .ai-chat-container {
    margin: 0 10px 10px;
  }
  
  .message-content {
    max-width: calc(100% - 44px);
  }
}
</style> 
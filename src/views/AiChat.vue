<template>
  <div class="ai-chat-container">
    <h1 class="ai-chat-title">智能助手</h1>
    
    <div class="chat-messages" ref="messagesContainer">
      <div
        v-for="message in aiChatStore.messages"
        :key="message.id"
        :class="['message', message.role === 'user' ? 'user-message' : 'ai-message']"
      >
        <div class="message-content">{{ message.content }}</div>
        <div class="message-time">{{ formatTime(message.timestamp) }}</div>
      </div>
      
      <div v-if="aiChatStore.isLoading" class="ai-typing">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
      
      <div v-if="aiChatStore.error" class="error-message">
        {{ aiChatStore.error }}
      </div>
    </div>
    
    <div class="chat-input-container">
      <textarea
        v-model="userInput"
        class="chat-input"
        placeholder="请输入消息..."
        @keydown.enter.prevent="sendMessage"
      ></textarea>
      <div class="chat-actions">
        <button @click="aiChatStore.clearChat" class="clear-button">清除对话</button>
        <button 
          @click="sendMessage" 
          :disabled="!userInput.trim() || aiChatStore.isLoading"
          class="send-button"
        >
          {{ aiChatStore.isLoading ? '发送中...' : '发送' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUpdated, computed, nextTick } from 'vue';
import { useAiChatStore } from '../store/ai-chat';

const aiChatStore = useAiChatStore();
const userInput = ref('');
const messagesContainer = ref<HTMLElement | null>(null);

// Send message and clear input
const sendMessage = async () => {
  if (!userInput.value.trim() || aiChatStore.isLoading) return;
  
  const message = userInput.value;
  userInput.value = '';
  await aiChatStore.sendMessage(message);
  
  // Scroll to bottom after sending message
  await nextTick();
  scrollToBottom();
};

// Format timestamp
const formatTime = (date: Date): string => {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Scroll to the bottom of the messages container
const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

// Scroll to bottom on mount
onMounted(() => {
  scrollToBottom();
});

// Scroll to bottom when messages update
onUpdated(() => {
  scrollToBottom();
});
</script>

<style scoped lang="scss">
.ai-chat-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.ai-chat-title {
  font-size: 24px;
  margin-bottom: 20px;
  text-align: center;
  color: #333;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 10px;
  margin-bottom: 20px;
}

.message {
  max-width: 80%;
  padding: 10px 15px;
  border-radius: 18px;
  position: relative;
  word-break: break-word;
  
  .message-content {
    margin-bottom: 4px;
  }
  
  .message-time {
    font-size: 10px;
    opacity: 0.7;
    text-align: right;
  }
}

.user-message {
  align-self: flex-end;
  background-color: #007AFF;
  color: white;
}

.ai-message {
  align-self: flex-start;
  background-color: #E5E5EA;
  color: #333;
}

.ai-typing {
  align-self: flex-start;
  background-color: #E5E5EA;
  padding: 10px 15px;
  border-radius: 18px;
  display: flex;
  gap: 4px;
  align-items: center;
  
  .dot {
    width: 8px;
    height: 8px;
    background-color: #999;
    border-radius: 50%;
    animation: typing 1.4s infinite both;
    
    &:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-5px);
  }
}

.error-message {
  color: #ff3b30;
  text-align: center;
  margin-top: 10px;
}

.chat-input-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chat-input {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid #ccc;
  border-radius: 20px;
  resize: none;
  height: 80px;
  font-family: inherit;
  font-size: 14px;
  outline: none;
  
  &:focus {
    border-color: #007AFF;
  }
}

.chat-actions {
  display: flex;
  justify-content: space-between;
}

.clear-button, .send-button {
  padding: 8px 16px;
  border-radius: 20px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.clear-button {
  background-color: #f1f1f1;
  color: #333;
  
  &:hover {
    background-color: #ddd;
  }
}

.send-button {
  background-color: #007AFF;
  color: white;
  
  &:disabled {
    background-color: #99c7ff;
    cursor: not-allowed;
  }
  
  &:not(:disabled):hover {
    background-color: #0062cc;
  }
}

@media (max-width: 600px) {
  .ai-chat-container {
    padding: 10px;
    height: calc(100vh - 100px);
  }
  
  .message {
    max-width: 90%;
  }
}
</style> 
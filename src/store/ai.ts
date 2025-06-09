import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as aiApi from '../api/ai'
import { AIAnalysis, ChatMessage } from '../api/ai'
import { joinAiChatRoom, onAiChatMessage } from '../utils/socket'

export const useAiStore = defineStore('ai', () => {
    // 状态
    const analysis = ref<AIAnalysis | null>(null)
    const chatMessages = ref<ChatMessage[]>([])
    const loading = ref(false)
    const error = ref('')
    const isAnalyzing = ref(false)

    // 操作
    // 分析照片
    const analyzePhoto = async (photoId: string): Promise<AIAnalysis | null> => {
        loading.value = true
        error.value = ''
        isAnalyzing.value = true

        try {
            const result = await aiApi.analyzePhoto(photoId)
            analysis.value = result
            isAnalyzing.value = false
            return result
        } catch (err: any) {
            error.value = err.response?.data?.error || '分析照片失败'
            isAnalyzing.value = false
            return null
        } finally {
            loading.value = false
        }
    }

    // 获取照片分析
    const getPhotoAnalysis = async (photoId: string): Promise<AIAnalysis | null> => {
        loading.value = true
        error.value = ''

        try {
            const result = await aiApi.getPhotoAnalysis(photoId)
            analysis.value = result
            return result
        } catch (err: any) {
            // 如果未找到分析，可能是尚未生成
            if (err.response?.status === 404) {
                return null
            }

            error.value = err.response?.data?.error || '获取照片分析失败'
            return null
        } finally {
            loading.value = false
        }
    }

    // 为照片生成标签
    const generateTags = async (photoId: string): Promise<string[]> => {
        loading.value = true
        error.value = ''

        try {
            const tags = await aiApi.generateTags(photoId)
            return tags
        } catch (err: any) {
            error.value = err.response?.data?.error || '生成标签失败'
            return []
        } finally {
            loading.value = false
        }
    }

    // 向AI发送消息
    const sendMessage = async (message: string): Promise<ChatMessage | null> => {
        loading.value = true
        error.value = ''

        try {
            const chatMessage = await aiApi.chat(message)
            chatMessages.value = [chatMessage, ...chatMessages.value]
            return chatMessage
        } catch (err: any) {
            error.value = err.response?.data?.error || '发送消息失败'
            return null
        } finally {
            loading.value = false
        }
    }

    // 获取聊天历史
    const getChatHistory = async (): Promise<ChatMessage[]> => {
        loading.value = true
        error.value = ''

        try {
            const messages = await aiApi.getChatHistory()
            chatMessages.value = messages
            return messages
        } catch (err: any) {
            error.value = err.response?.data?.error || '获取聊天历史失败'
            return []
        } finally {
            loading.value = false
        }
    }

    // 初始化用户聊天
    const initChat = (userId: string) => {
        joinAiChatRoom(userId)
        setupChatListeners()
    }

    // 设置聊天socket监听器
    const setupChatListeners = () => {
        onAiChatMessage((message) => {
            // 检查消息是否已存在
            const exists = chatMessages.value.some(m => m.id === message.id)
            if (!exists) {
                chatMessages.value = [message, ...chatMessages.value]
            }
        })
    }

    // 重置存储
    const reset = () => {
        analysis.value = null
        chatMessages.value = []
        isAnalyzing.value = false
    }

    return {
        // 状态
        analysis,
        chatMessages,
        loading,
        error,
        isAnalyzing,

        // 操作
        analyzePhoto,
        getPhotoAnalysis,
        generateTags,
        sendMessage,
        getChatHistory,
        initChat,
        reset
    }
}) 
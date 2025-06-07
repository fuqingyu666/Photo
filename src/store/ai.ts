import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as aiApi from '../api/ai'
import { AIAnalysis, ChatMessage } from '../api/ai'
import { joinAiChatRoom, onAiChatMessage } from '../utils/socket'

export const useAiStore = defineStore('ai', () => {
    // State
    const analysis = ref<AIAnalysis | null>(null)
    const chatMessages = ref<ChatMessage[]>([])
    const loading = ref(false)
    const error = ref('')
    const isAnalyzing = ref(false)

    // Actions
    // Analyze a photo
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
            error.value = err.response?.data?.error || 'Failed to analyze photo'
            isAnalyzing.value = false
            return null
        } finally {
            loading.value = false
        }
    }

    // Get photo analysis
    const getPhotoAnalysis = async (photoId: string): Promise<AIAnalysis | null> => {
        loading.value = true
        error.value = ''

        try {
            const result = await aiApi.getPhotoAnalysis(photoId)
            analysis.value = result
            return result
        } catch (err: any) {
            // If analysis not found, it might not have been generated yet
            if (err.response?.status === 404) {
                return null
            }

            error.value = err.response?.data?.error || 'Failed to get photo analysis'
            return null
        } finally {
            loading.value = false
        }
    }

    // Generate tags for a photo
    const generateTags = async (photoId: string): Promise<string[]> => {
        loading.value = true
        error.value = ''

        try {
            const tags = await aiApi.generateTags(photoId)
            return tags
        } catch (err: any) {
            error.value = err.response?.data?.error || 'Failed to generate tags'
            return []
        } finally {
            loading.value = false
        }
    }

    // Send a message to AI
    const sendMessage = async (message: string): Promise<ChatMessage | null> => {
        loading.value = true
        error.value = ''

        try {
            const chatMessage = await aiApi.chat(message)
            chatMessages.value = [chatMessage, ...chatMessages.value]
            return chatMessage
        } catch (err: any) {
            error.value = err.response?.data?.error || 'Failed to send message'
            return null
        } finally {
            loading.value = false
        }
    }

    // Get chat history
    const getChatHistory = async (): Promise<ChatMessage[]> => {
        loading.value = true
        error.value = ''

        try {
            const messages = await aiApi.getChatHistory()
            chatMessages.value = messages
            return messages
        } catch (err: any) {
            error.value = err.response?.data?.error || 'Failed to get chat history'
            return []
        } finally {
            loading.value = false
        }
    }

    // Initialize chat with user ID
    const initChat = (userId: string) => {
        joinAiChatRoom(userId)
        setupChatListeners()
    }

    // Set up chat socket listeners
    const setupChatListeners = () => {
        onAiChatMessage((message) => {
            // Check if message already exists
            const exists = chatMessages.value.some(m => m.id === message.id)
            if (!exists) {
                chatMessages.value = [message, ...chatMessages.value]
            }
        })
    }

    // Reset store
    const reset = () => {
        analysis.value = null
        chatMessages.value = []
        isAnalyzing.value = false
    }

    return {
        // State
        analysis,
        chatMessages,
        loading,
        error,
        isAnalyzing,

        // Actions
        analyzePhoto,
        getPhotoAnalysis,
        generateTags,
        sendMessage,
        getChatHistory,
        initChat,
        reset
    }
}) 
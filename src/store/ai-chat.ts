import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
}

export const useAiChatStore = defineStore('ai-chat', () => {
    const messages = ref<ChatMessage[]>([])
    const isLoading = ref(false)
    const error = ref('')

    // 限制消息显示数量
    const MAX_MESSAGES = 5

    // Mock AI response function
    const mockAiResponse = async (content: string): Promise<string> => {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))

        const responses = [
            "我是DeepSeek AI，这是一个模拟助手。在真实应用中，这会调用DeepSeek API。",
            "这是个很有趣的问题！这里是来自DeepSeek的模拟回复。",
            "谢谢分享！我目前只是一个模拟实现，但在生产环境中我将连接到DeepSeek AI API。",
            "我很乐意帮助您解决这个问题。在实际实现中，强大的DeepSeek AI会分析您的请求。",
            "好问题！在完整实现中，DeepSeek AI会根据其广泛的知识提供详细的回答。"
        ]

        // If the message contains a greeting, respond with a greeting
        if (content.toLowerCase().includes('你好') || content.toLowerCase().includes('嗨') || content.toLowerCase().includes('您好')) {
            return "你好！我是你的DeepSeek AI助手。今天有什么可以帮到您的吗？"
        }

        // If the message asks for the assistant's identity
        if (content.toLowerCase().includes('你是谁') || content.toLowerCase().includes('你是什么')) {
            return "我是DeepSeek AI助手（在此演示中模拟）。我的设计目的是进行对话并提供有用的信息。"
        }

        // Otherwise return a random response
        return responses[Math.floor(Math.random() * responses.length)]
    }

    // Send a message and get AI response
    const sendMessage = async (content: string) => {
        if (!content.trim()) return

        // Add user message
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date()
        }

        messages.value.push(userMessage)

        // 限制消息数量
        if (messages.value.length > MAX_MESSAGES * 2) { // 考虑用户和AI消息对
            messages.value = messages.value.slice(-MAX_MESSAGES * 2)
        }

        // Generate AI response
        isLoading.value = true
        error.value = ''

        try {
            const aiResponse = await mockAiResponse(content)

            const assistantMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: aiResponse,
                timestamp: new Date()
            }

            messages.value.push(assistantMessage)

            // 再次检查和限制消息数量
            if (messages.value.length > MAX_MESSAGES * 2) {
                messages.value = messages.value.slice(-MAX_MESSAGES * 2)
            }
        } catch (err) {
            console.error('AI响应错误:', err)
            error.value = '获取AI回复失败，请重试。'
        } finally {
            isLoading.value = false
        }
    }

    // Clear chat history
    const clearChat = () => {
        messages.value = []
        initializeChat()
    }

    // Add welcome message on initialization
    const initializeChat = () => {
        const welcomeMessage: ChatMessage = {
            id: 'welcome',
            role: 'assistant',
            content: "你好！我是DeepSeek AI助手。有什么可以帮到您的吗？",
            timestamp: new Date()
        }

        messages.value = [welcomeMessage]
    }

    // Initialize chat
    initializeChat()

    return {
        messages,
        isLoading,
        error,
        sendMessage,
        clearChat
    }
}) 
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from './auth'
import { v4 as uuidv4 } from 'uuid'

export interface ChatMessage {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: Date
}

export interface StreamOptions {
    onStream?: (chunk: string) => void
    signal?: AbortSignal
}

export const useAiChatStore = defineStore('ai-chat', () => {
    // State
    const messages = ref<ChatMessage[]>([])
    const isLoading = ref(false)
    const error = ref('')
    const currentStreamingMessage = ref<ChatMessage | null>(null)
    const authStore = useAuthStore()

    // Getters
    const lastMessage = computed(() => {
        if (messages.value.length === 0) {
            return null
        }
        return messages.value[messages.value.length - 1]
    })

    // 历史消息限制
    const MAX_DISPLAY_MESSAGES = 50
    const MAX_CONTEXT_MESSAGES = 10

    // 调用DeepSeek API（非流式）
    const callDeepSeekAPI = async (content: string): Promise<string> => {
        try {
            // 获取最近的上下文消息
            const contextMessages = messages.value
                .slice(-MAX_CONTEXT_MESSAGES)
                .map(msg => ({
                    role: msg.role === 'system' ? 'system' : msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }));

            // 调用后端API
            const response = await axios.post('/api/ai/chat',
                {
                    message: content,
                    context: contextMessages
                },
                {
                    headers: {
                        'Authorization': `Bearer ${authStore.token}`
                    }
                });

            if (response.data && response.data.response) {
                return response.data.response;
            } else {
                throw new Error('Invalid AI response');
            }
        } catch (error) {
            console.error('Failed to call DeepSeek API:', error);
            // 如果API调用失败，回退到模拟响应
            return mockAiResponse(content);
        }
    };

    // Mock AI response function (用于API未配置或调用失败时)
    const mockAiResponse = async (content: string): Promise<string> => {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))

        const responses = [
            "I'm a DeepSeek AI simulation. In a real application, this would call the DeepSeek API.",
            "That's an interesting question! This is a simulated response from DeepSeek.",
            "Thanks for sharing! I'm currently just a mock implementation, but in production I would connect to the DeepSeek AI API.",
            "I'd be happy to help with that. In a real implementation, the powerful DeepSeek AI would analyze your request.",
            "Good question! In a full implementation, DeepSeek AI would provide detailed answers based on its extensive knowledge."
        ]

        // If the message contains a greeting, respond with a greeting
        if (content.toLowerCase().includes('hello') ||
            content.toLowerCase().includes('hi') ||
            content.toLowerCase().includes('hey')) {
            return "Hello! I'm your DeepSeek AI assistant. How can I help you today?";
        }

        // If the message asks for the assistant's identity
        if (content.toLowerCase().includes('who are you') ||
            content.toLowerCase().includes('what are you')) {
            return "I'm a DeepSeek AI assistant (simulated in this demo). I'm designed to have conversations and provide useful information.";
        }

        // Otherwise return a random response
        return responses[Math.floor(Math.random() * responses.length)]
    }

    // 持久化对话历史
    const saveMessagesToStorage = () => {
        try {
            const messagesToSave = messages.value.map(msg => ({
                ...msg,
                timestamp: msg.timestamp.toISOString()
            }));
            localStorage.setItem('ai_chat_history', JSON.stringify(messagesToSave));
        } catch (err) {
            console.error('Failed to save chat history:', err);
        }
    };

    // 从存储加载对话历史
    const loadMessagesFromStorage = () => {
        try {
            const savedMessages = localStorage.getItem('ai_chat_history');
            if (savedMessages) {
                const parsedMessages = JSON.parse(savedMessages);
                messages.value = parsedMessages.map((msg: any) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                }));
            } else {
                initializeChat();
            }
        } catch (err) {
            console.error('Failed to load chat history:', err);
            initializeChat();
        }
    };

    // Add a user message
    const addUserMessage = async (content: string): Promise<ChatMessage> => {
        const message: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content,
            timestamp: new Date()
        }
        messages.value.push(message)

        // 限制显示的消息数量
        if (messages.value.length > MAX_DISPLAY_MESSAGES) {
            messages.value = messages.value.slice(-MAX_DISPLAY_MESSAGES)
        }

        saveMessagesToStorage();
        return message
    }

    // Add an AI message
    const addAIMessage = async (content: string): Promise<ChatMessage> => {
        const message: ChatMessage = {
            id: uuidv4(),
            role: 'assistant',
            content,
            timestamp: new Date()
        }
        messages.value.push(message)
        saveMessagesToStorage();
        return message
    }

    // Add a system message
    const addSystemMessage = async (content: string): Promise<ChatMessage> => {
        const message: ChatMessage = {
            id: uuidv4(),
            role: 'system',
            content,
            timestamp: new Date()
        }
        messages.value.push(message)
        saveMessagesToStorage();
        return message
    }

    // Update current streaming message
    const updateStreamingMessage = (chunk: string): void => {
        if (currentStreamingMessage.value) {
            currentStreamingMessage.value.content += chunk
            saveMessagesToStorage();
        }
    }

    // Send a message and get AI response
    const sendMessage = async (content: string, options?: StreamOptions): Promise<ChatMessage | null> => {
        error.value = ''
        isLoading.value = true

        try {
            // Prepare context for API
            const context = messages.value
                .slice(-MAX_CONTEXT_MESSAGES)
                .map(msg => ({
                    role: msg.role === 'system' ? 'system' : msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }));

            // Check if we want to use streaming
            if (options?.onStream) {
                // Create a placeholder message for streaming
                currentStreamingMessage.value = {
                    id: uuidv4(),
                    role: 'assistant',
                    content: '',
                    timestamp: new Date()
                }
                messages.value.push(currentStreamingMessage.value)

                // Create and process stream
                try {
                    // Request the stream from the server
                    const response = await fetch('/api/ai/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'text/event-stream',
                            'Authorization': `Bearer ${authStore.token}`
                        },
                        body: JSON.stringify({ message: content, context }),
                        signal: options.signal
                    })

                    if (!response.ok) {
                        throw new Error(`Server returned ${response.status}`)
                    }

                    const reader = response.body?.getReader()
                    if (!reader) throw new Error('Response body stream not available')

                    // Read stream data
                    const decoder = new TextDecoder()
                    let buffer = ''

                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break

                        buffer += decoder.decode(value, { stream: true })
                        const lines = buffer.split('\n\n')
                        buffer = lines.pop() || ''

                        for (const line of lines) {
                            if (!line.startsWith('data:')) continue

                            try {
                                const json = JSON.parse(line.slice(5))
                                if (json.content === '[START]') {
                                    // Stream start, no action needed
                                } else if (json.content === '[DONE]') {
                                    // Stream completed
                                    isLoading.value = false
                                } else if (json.content && json.content.startsWith('[ERROR]')) {
                                    // Handle error
                                    throw new Error(json.content.substring(8))
                                } else if (json.content) {
                                    // Receive content
                                    updateStreamingMessage(json.content)
                                    if (options.onStream) {
                                        options.onStream(json.content)
                                    }
                                }
                            } catch (e) {
                                console.error('Error parsing SSE:', e, line)
                            }
                        }
                    }

                    // Return the completed message
                    const completedMessage = currentStreamingMessage.value
                    currentStreamingMessage.value = null
                    saveMessagesToStorage();
                    return completedMessage

                } catch (err) {
                    // Handle stream errors
                    if (err instanceof DOMException && err.name === 'AbortError') {
                        console.log('Stream cancelled by user')
                        // Don't set an error when intentionally cancelled
                    } else {
                        console.error('Stream error:', err)
                        error.value = err instanceof Error ? err.message : 'Error streaming response'

                        // Add error message to chat if streaming failed
                        if (currentStreamingMessage.value) {
                            // If we have some content already, keep it
                            if (currentStreamingMessage.value.content.length === 0) {
                                currentStreamingMessage.value.content =
                                    "Sorry, there was an error processing your request. Please try again.";
                                saveMessagesToStorage();
                            }
                        }
                    }
                    return null
                } finally {
                    currentStreamingMessage.value = null
                    isLoading.value = false
                }
            } else {
                // Regular non-streaming API call
                try {
                    const aiResponse = await callDeepSeekAPI(content)
                    const aiMessage = await addAIMessage(aiResponse)
                    return aiMessage
                } catch (err) {
                    console.error('Error calling API:', err)
                    error.value = err instanceof Error ? err.message : 'Failed to get AI response'
                    return null
                } finally {
                    isLoading.value = false
                }
            }
        } catch (err) {
            console.error('Error sending message:', err)
            error.value = err instanceof Error ? err.message : 'Failed to send message'
            isLoading.value = false
            return null
        }
    }

    // Load messages from server
    const loadMessages = async (limit: number = 50): Promise<ChatMessage[]> => {
        try {
            // First try to load from localStorage for quick startup
            loadMessagesFromStorage();

            // Then try to get from server in the background
            const response = await axios.get(`/api/ai/chat/history?limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${authStore.token}`
                }
            });

            if (response.data && response.data.messages && response.data.messages.length > 0) {
                // Convert to our message format
                const serverMessages = response.data.messages.map((msg: any) => ({
                    id: msg.id || uuidv4(),
                    role: msg.user_id ? 'user' : 'assistant',
                    content: msg.user_id ? msg.message : (msg.response || ''),
                    timestamp: new Date(msg.created_at || Date.now())
                }));

                // Sort from oldest to newest
                serverMessages.sort((a: ChatMessage, b: ChatMessage) =>
                    a.timestamp.getTime() - b.timestamp.getTime()
                );

                // If server has more recent messages than local storage, use server's
                if (serverMessages.length > 0) {
                    const localLatestTimestamp = lastMessage.value?.timestamp.getTime() || 0;
                    const serverLatestTimestamp = serverMessages[serverMessages.length - 1].timestamp.getTime();

                    if (serverLatestTimestamp > localLatestTimestamp) {
                        messages.value = serverMessages;
                        saveMessagesToStorage();
                    }
                }
            }

            return messages.value;
        } catch (err) {
            console.error('Error loading messages from server:', err);
            // If server request fails, we still have local messages
            return messages.value;
        }
    }

    // Clear all messages
    const clearMessages = () => {
        messages.value = []
        error.value = ''
        initializeChat()
    }

    // Add welcome message on initialization
    const initializeChat = () => {
        const welcomeMessage: ChatMessage = {
            id: 'welcome',
            role: 'assistant',
            content: "Hello! I'm your DeepSeek AI photo assistant. How can I help you with your photos today?",
            timestamp: new Date()
        }

        messages.value = [welcomeMessage]
        saveMessagesToStorage();
    }

    // Initialize chat on store creation
    loadMessagesFromStorage();

    return {
        // State
        messages,
        isLoading,
        error,

        // Getters
        lastMessage,

        // Actions
        addUserMessage,
        addAIMessage,
        addSystemMessage,
        sendMessage,
        loadMessages,
        clearMessages
    }
}) 
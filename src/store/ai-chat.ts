import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from './auth'
import { v4 as uuidv4 } from 'uuid'

/**
 * 聊天消息接口
 * 定义AI对话中的消息结构
 */
export interface ChatMessage {
    id: string               // 消息唯一ID
    role: 'user' | 'assistant' | 'system' // 消息角色：用户、AI助手或系统
    content: string          // 消息内容
    timestamp: Date          // 消息时间戳
}

/**
 * 流式传输选项接口
 * 用于处理AI响应的流式传输
 */
export interface StreamOptions {
    onStream?: (chunk: string) => void  // 处理流式数据块的回调函数
    signal?: AbortSignal                // 用于取消请求的信号
}

/**
 * AI聊天状态管理
 * 处理与AI对话的全部逻辑，包括消息存储、发送和接收
 */
export const useAiChatStore = defineStore('ai-chat', () => {
    // 状态定义
    const messages = ref<ChatMessage[]>([])       // 所有对话消息
    const isLoading = ref(false)                  // 加载状态
    const error = ref('')                         // 错误信息
    const currentStreamingMessage = ref<ChatMessage | null>(null) // 当前正在流式传输的消息
    const authStore = useAuthStore()              // 认证状态

    // 计算属性
    const lastMessage = computed(() => {
        if (messages.value.length === 0) {
            return null
        }
        return messages.value[messages.value.length - 1]
    })

    // 历史消息限制
    const MAX_DISPLAY_MESSAGES = 50               // 最大显示消息数
    const MAX_CONTEXT_MESSAGES = 10               // 发送给API的上下文消息数

    /**
     * 调用DeepSeek AI API（非流式）
     * 发送用户消息到AI并获取完整回复
     * @param content 用户消息内容
     * @returns AI回复内容
     */
    const callDeepSeekAPI = async (content: string): Promise<string> => {
        try {
            // 获取最近的上下文消息
            const contextMessages = messages.value
                .slice(-MAX_CONTEXT_MESSAGES)
                .map(msg => ({
                    role: msg.role === 'system' ? 'system' : msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }));

            // 直接调用SiliconFlow API
            const apiKey = 'sk-yxxplzgtjouqhvdtikrmmrzepaigzarzfjrtrmolbxbamjyj'; // SiliconFlow API 密钥

            const requestBody = {
                model: "Qwen/QwQ-32B",           // 使用通义千问模型
                messages: [
                    ...contextMessages,
                    { role: 'user', content: content }
                ],
                stream: false,                    // 非流式传输
                max_tokens: 512,                  // 最大生成令牌数
                temperature: 0.7,                 // 温度参数，控制输出随机性
                top_p: 0.7                        // 核采样参数
            };

            console.log('发送请求:', JSON.stringify(requestBody, null, 2));

            const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API返回错误: ${response.status} ${response.statusText}`, errorText);
                throw new Error(`API返回错误: ${response.status} ${response.statusText}`);
            }

            const responseData = await response.json();
            console.log('API响应:', responseData);

            if (responseData && responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
                return responseData.choices[0].message.content;
            } else {
                console.error('无效的DeepSeek API响应结构:', responseData);
                throw new Error('无效的API响应结构');
            }
        } catch (error) {
            console.error('调用DeepSeek API失败:', error);
            // 如果API调用失败，回退到模拟响应
            return mockAiResponse(content);
        }
    };

    /**
     * 模拟AI响应函数
     * 在API未配置或调用失败时提供模拟回复
     * @param content 用户消息内容
     * @returns 模拟的AI回复
     */
    const mockAiResponse = async (content: string): Promise<string> => {
        // 模拟API延迟
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))

        const responses = [
            "我是DeepSeek AI模拟。在实际应用中，这里会调用DeepSeek API。",
            "这是个有趣的问题！这是来自DeepSeek的模拟响应。",
            "感谢您的分享！我目前只是一个模拟实现，但在生产环境中我会连接到DeepSeek AI API。",
            "我很乐意帮助您。在实际实现中，强大的DeepSeek AI会分析您的请求。",
            "好问题！在完整实现中，DeepSeek AI会基于其广泛的知识提供详细答案。"
        ]

        // 如果消息包含问候，回复问候
        if (content.toLowerCase().includes('你好') ||
            content.toLowerCase().includes('hello') ||
            content.toLowerCase().includes('hi')) {
            return "你好！我是您的DeepSeek AI助手。今天我能为您做什么？";
        }

        // 如果消息询问助手的身份
        if (content.toLowerCase().includes('你是谁') ||
            content.toLowerCase().includes('你是什么')) {
            return "我是DeepSeek AI助手（在此演示中模拟）。我被设计用来进行对话并提供有用的信息。";
        }

        // 否则返回随机响应
        return responses[Math.floor(Math.random() * responses.length)]
    }

    /**
     * 持久化对话历史
     * 将对话保存到本地存储，确保页面刷新后对话不丢失
     */
    const saveMessagesToStorage = () => {
        try {
            const messagesToSave = messages.value.map(msg => ({
                ...msg,
                timestamp: msg.timestamp.toISOString()
            }));
            localStorage.setItem('ai_chat_history', JSON.stringify(messagesToSave));
        } catch (err) {
            console.error('保存聊天历史失败:', err);
        }
    };

    /**
     * 从存储加载对话历史
     * 页面加载时恢复之前的对话
     */
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
            console.error('加载聊天历史失败:', err);
            initializeChat();
        }
    };

    /**
     * 添加用户消息
     * 将用户输入的消息添加到对话历史
     * @param content 用户消息内容
     * @returns 创建的消息对象
     */
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

    /**
     * 添加AI消息
     * 将AI的回复添加到对话历史
     * @param content AI消息内容
     * @returns 创建的消息对象
     */
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

    /**
     * 添加系统消息
     * 添加系统通知或提示到对话历史
     * @param content 系统消息内容
     * @returns 创建的消息对象
     */
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

    /**
     * 更新正在流式传输的消息
     * 在收到流式数据块时追加到当前消息
     * @param chunk 收到的数据块
     */
    const updateStreamingMessage = (chunk: string): void => {
        if (currentStreamingMessage.value) {
            currentStreamingMessage.value.content += chunk
            saveMessagesToStorage();
        }
    }

    /**
     * 发送消息并获取AI回复
     * 处理用户消息发送和AI响应接收的完整流程
     * @param content 用户消息内容
     * @param options 流式传输选项
     * @returns 创建的AI回复消息或null
     */
    const sendMessage = async (content: string, options?: StreamOptions): Promise<ChatMessage | null> => {
        error.value = ''
        isLoading.value = true

        try {
            // 准备发送给API的上下文
            const context = messages.value
                .slice(-MAX_CONTEXT_MESSAGES)
                .map(msg => ({
                    role: msg.role === 'system' ? 'system' : msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }));

            // 检查是否使用流式传输
            if (options?.onStream) {
                // 创建流式传输的占位消息
                currentStreamingMessage.value = {
                    id: uuidv4(),
                    role: 'assistant',
                    content: '',
                    timestamp: new Date()
                }
                messages.value.push(currentStreamingMessage.value)

                // 创建并处理流式传输
                try {
                    // 使用SiliconFlow API的流式接口
                    const apiKey = 'sk-yxxplzgtjouqhvdtikrmmrzepaigzarzfjrtrmolbxbamjyj';

                    const requestBody = {
                        model: "Qwen/QwQ-32B", // 使用通义千问模型
                        messages: [
                            ...context,
                            { role: 'user', content }
                        ],
                        stream: true,           // 启用流式传输
                        max_tokens: 512,        // 最大生成令牌数
                        temperature: 0.7,        // 温度参数，控制输出随机性
                        top_p: 0.7               // 核采样参数
                    };

                    console.log('发送流式请求:', JSON.stringify(requestBody, null, 2));

                    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                            'Accept': 'text/event-stream'
                        },
                        body: JSON.stringify(requestBody),
                        signal: options.signal
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`API返回错误: ${response.status} ${response.statusText}`, errorText);
                        throw new Error(`API返回错误: ${response.status} ${response.statusText}`);
                    }

                    const reader = response.body?.getReader();
                    if (!reader) throw new Error('响应流不可用');

                    // 读取流数据
                    const decoder = new TextDecoder();
                    let buffer = '';

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        // 解码当前块
                        buffer += decoder.decode(value, { stream: true });

                        // 按行分割，处理每个事件
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (line.trim() === '' || !line.startsWith('data:')) continue;

                            try {
                                // 解析事件数据
                                const eventData = line.slice(5).trim();
                                if (eventData === '[DONE]') {
                                    // 流完成
                                    isLoading.value = false;
                                    continue;
                                }

                                const json = JSON.parse(eventData);
                                console.log('流式响应块:', json);

                                if (json.choices && json.choices[0]) {
                                    if (json.choices[0].delta && json.choices[0].delta.content) {
                                        // 获取增量内容
                                        const delta = json.choices[0].delta.content;
                                        // 更新消息
                                        updateStreamingMessage(delta);
                                        if (options.onStream) {
                                            options.onStream(delta);
                                        }
                                    } else if (json.choices[0].finish_reason) {
                                        console.log('流式响应完成:', json.choices[0].finish_reason);
                                    }
                                }
                            } catch (e) {
                                console.error('解析SSE错误:', e, line);
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
                        console.log('用户取消了流式响应')
                        // Don't set an error when intentionally cancelled
                    } else {
                        console.error('流式响应错误:', err)
                        error.value = err instanceof Error ? err.message : '获取AI响应时出错'

                        // Add error message to chat if streaming failed
                        if (currentStreamingMessage.value) {
                            // If we have some content already, keep it
                            if (currentStreamingMessage.value.content.length === 0) {
                                currentStreamingMessage.value.content =
                                    "抱歉，处理您的请求时出现错误。请重试。";
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
                    console.error('调用API错误:', err)
                    error.value = err instanceof Error ? err.message : '获取AI响应失败'
                    return null
                } finally {
                    isLoading.value = false
                }
            }
        } catch (err) {
            console.error('发送消息错误:', err)
            error.value = err instanceof Error ? err.message : '发送消息失败'
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
                baseURL: "http://localhost:5000",
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
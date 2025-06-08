import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import pool from '../config/database';
import env from '../config/env';

export interface AIAnalysis {
    id: string;
    photo_id: string;
    analysis_data: {
        tags?: string[];
        description?: string;
        objects?: Array<{
            name: string;
            confidence: number;
            boundingBox?: {
                x: number;
                y: number;
                width: number;
                height: number;
            };
        }>;
        colors?: Array<{
            color: string;
            percentage: number;
        }>;
        [key: string]: any;
    };
    created_at?: Date;
    updated_at?: Date;
}

export interface ChatMessage {
    id: string;
    user_id: string;
    message: string;
    response?: string;
    created_at?: Date;
}

// Maximum tokens for context history
const MAX_CONTEXT_TOKENS = 2000;
// Approximate token count per character for English text
const TOKENS_PER_CHAR = 0.25;

export class AIModel {
    /**
     * Analyze photo using DeepSeek API
     */
    static async analyzePhoto(photoId: string, photoUrl: string): Promise<AIAnalysis> {
        try {
            // Check if analysis already exists
            const existingAnalysis = await this.findByPhotoId(photoId);
            if (existingAnalysis) {
                return existingAnalysis;
            }

            // Call DeepSeek API for image analysis
            let analysisData;

            if (env.DEEPSEEK_API_KEY) {
                try {
                    const response = await axios.post(
                        `${env.DEEPSEEK_API_URL}/v1/vision/analyze`,
                        {
                            image_url: photoUrl,
                            features: ['tags', 'description', 'objects', 'colors']
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    analysisData = response.data;
                } catch (error) {
                    console.error('DeepSeek API error:', error);
                    // Fallback to mock data if API call fails
                    analysisData = this.mockAnalysisData(photoUrl);
                }
            } else {
                // Mock response if API key is not set
                analysisData = this.mockAnalysisData(photoUrl);
            }

            // Save analysis to database
            const id = uuidv4();
            await pool.execute(
                'INSERT INTO ai_analysis (id, photo_id, analysis_data) VALUES (?, ?, ?)',
                [id, photoId, JSON.stringify(analysisData)]
            );

            return {
                id,
                photo_id: photoId,
                analysis_data: analysisData
            };
        } catch (error) {
            console.error('Error analyzing photo:', error);

            // Save error analysis
            const id = uuidv4();
            const errorData = {
                error: 'Failed to analyze photo',
                message: error instanceof Error ? error.message : 'Unknown error'
            };

            await pool.execute(
                'INSERT INTO ai_analysis (id, photo_id, analysis_data) VALUES (?, ?, ?)',
                [id, photoId, JSON.stringify(errorData)]
            );

            return {
                id,
                photo_id: photoId,
                analysis_data: errorData
            };
        }
    }

    /**
     * Find analysis by photo ID
     */
    static async findByPhotoId(photoId: string): Promise<AIAnalysis | null> {
        const [rows] = await pool.execute(
            'SELECT * FROM ai_analysis WHERE photo_id = ?',
            [photoId]
        );

        if ((rows as any[]).length === 0) {
            return null;
        }

        const analysis = (rows as any[])[0];
        return {
            id: analysis.id,
            photo_id: analysis.photo_id,
            analysis_data: JSON.parse(analysis.analysis_data),
            created_at: analysis.created_at,
            updated_at: analysis.updated_at
        };
    }

    /**
     * Chat with AI about photos
     */
    static async chat(userId: string, message: string, context: Array<{ role: string, content: string }> = []): Promise<ChatMessage> {
        try {
            // Create chat message
            const id = uuidv4();

            // Call DeepSeek API for chat
            let response: string;

            if (env.DEEPSEEK_API_KEY) {
                try {
                    // Prepare messages array for DeepSeek API
                    const systemMessage = {
                        role: 'system',
                        content: 'You are a helpful assistant specialized in discussing photos and images. Be concise, accurate, and friendly.'
                    };

                    // Validate and filter context
                    const validatedContext = context.filter(msg =>
                        ['system', 'user', 'assistant'].includes(msg.role) &&
                        typeof msg.content === 'string'
                    );

                    // Apply context window management
                    const trimmedContext = this.trimContextToFit(validatedContext);

                    // Build the messages array for the chat API
                    const messages = [
                        systemMessage,
                        ...trimmedContext
                    ];

                    // If context doesn't include the current message, add it
                    if (!trimmedContext.some(msg => msg.role === 'user' && msg.content === message)) {
                        messages.push({ role: 'user', content: message });
                    }

                    // Call DeepSeek API
                    const apiResponse = await axios.post(
                        `${env.DEEPSEEK_API_URL}/v1/chat/completions`,
                        {
                            model: 'deepseek-chat',
                            messages,
                            temperature: 0.7,
                            max_tokens: 800,
                            stream: false
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 15000 // 15 seconds timeout
                        }
                    );

                    response = apiResponse.data.choices[0].message.content;
                } catch (error) {
                    console.error('DeepSeek API error:', error);
                    // Fallback to mock response if API call fails
                    response = this.mockChatResponse(message);
                }
            } else {
                // Mock response if API key is not set
                response = this.mockChatResponse(message);
            }

            // Save message and response to database
            await pool.execute(
                'INSERT INTO ai_chat_messages (id, user_id, message, response) VALUES (?, ?, ?, ?)',
                [id, userId, message, response]
            );

            return {
                id,
                user_id: userId,
                message,
                response
            };
        } catch (error) {
            console.error('Error chatting with AI:', error);

            // Save error message
            const id = uuidv4();
            const errorResponse = 'Sorry, I encountered an error processing your request. Please try again later.';

            await pool.execute(
                'INSERT INTO ai_chat_messages (id, user_id, message, response) VALUES (?, ?, ?, ?)',
                [id, userId, message, errorResponse]
            );

            return {
                id,
                user_id: userId,
                message,
                response: errorResponse
            };
        }
    }

    /**
     * Chat with AI and stream the response
     */
    static async streamChat(userId: string, message: string, context: Array<{ role: string, content: string }> = [], onChunk: (chunk: string) => void): Promise<ChatMessage> {
        try {
            // Create chat message ID
            const id = uuidv4();
            let fullResponse = '';

            // Check if DeepSeek API is available
            if (env.DEEPSEEK_API_KEY) {
                try {
                    // Prepare messages array for DeepSeek API
                    const systemMessage = {
                        role: 'system',
                        content: 'You are a helpful assistant specialized in discussing photos and images. Be concise, accurate, and friendly.'
                    };

                    // Validate and trim context
                    const validatedContext = context.filter(msg =>
                        ['system', 'user', 'assistant'].includes(msg.role) &&
                        typeof msg.content === 'string'
                    );

                    // Apply context window management
                    const trimmedContext = this.trimContextToFit(validatedContext);

                    // Build the messages array
                    const messages = [
                        systemMessage,
                        ...trimmedContext
                    ];

                    // If context doesn't include the current message, add it
                    if (!trimmedContext.some(msg => msg.role === 'user' && msg.content === message)) {
                        messages.push({ role: 'user', content: message });
                    }

                    // Stream response from DeepSeek API
                    const response = await axios.post(
                        `${env.DEEPSEEK_API_URL}/v1/chat/completions`,
                        {
                            model: 'deepseek-chat',
                            messages,
                            temperature: 0.7,
                            max_tokens: 800,
                            stream: true
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
                                'Content-Type': 'application/json',
                                'Accept': 'text/event-stream'
                            },
                            responseType: 'stream',
                            timeout: 30000 // 30 seconds timeout
                        }
                    );

                    // Process streaming response
                    response.data.on('data', (chunk: Buffer) => {
                        const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const data = line.substring(6);

                                // Check for [DONE] signal
                                if (data === '[DONE]') {
                                    return;
                                }

                                try {
                                    const parsed = JSON.parse(data);
                                    const content = parsed.choices[0]?.delta?.content || '';

                                    if (content) {
                                        fullResponse += content;
                                        onChunk(content);
                                    }
                                } catch (e) {
                                    console.error('Error parsing streaming response:', e);
                                }
                            }
                        }
                    });

                    // Wait for stream to complete
                    await new Promise<void>((resolve) => {
                        response.data.on('end', () => {
                            resolve();
                        });
                    });
                } catch (error) {
                    console.error('DeepSeek API streaming error:', error);
                    // Fallback to non-streaming implementation
                    const mockResponse = this.mockChatResponse(message);
                    fullResponse = mockResponse;
                    onChunk(mockResponse);
                }
            } else {
                // Mock streaming response if API key is not set
                const mockResponse = this.mockChatResponse(message);

                // Simulate streaming by sending chunks of the response
                const chunks = mockResponse.match(/.{1,20}/g) || [];
                for (const chunk of chunks) {
                    onChunk(chunk);
                    await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between chunks
                }

                fullResponse = mockResponse;
            }

            // Save message and response to database
            await pool.execute(
                'INSERT INTO ai_chat_messages (id, user_id, message, response) VALUES (?, ?, ?, ?)',
                [id, userId, message, fullResponse]
            );

            return {
                id,
                user_id: userId,
                message,
                response: fullResponse
            };
        } catch (error) {
            console.error('Error streaming chat with AI:', error);

            // Save error message
            const id = uuidv4();
            const errorResponse = 'Sorry, I encountered an error processing your request. Please try again later.';
            onChunk(errorResponse);

            await pool.execute(
                'INSERT INTO ai_chat_messages (id, user_id, message, response) VALUES (?, ?, ?, ?)',
                [id, userId, message, errorResponse]
            );

            return {
                id,
                user_id: userId,
                message,
                response: errorResponse
            };
        }
    }

    /**
     * Trim context to fit token limit
     * @private
     */
    private static trimContextToFit(context: Array<{ role: string, content: string }>): Array<{ role: string, content: string }> {
        if (context.length === 0) return [];

        // Calculate total tokens (rough estimation)
        let totalTokens = 0;
        for (const msg of context) {
            // Each message has some overhead tokens
            const tokenEstimate = Math.ceil((msg.content.length * TOKENS_PER_CHAR) + 4);
            totalTokens += tokenEstimate;
        }

        // If under limit, return as is
        if (totalTokens <= MAX_CONTEXT_TOKENS) {
            return context;
        }

        // Otherwise, trim from oldest messages first until under limit
        const trimmedContext = [...context];
        while (trimmedContext.length > 0) {
            // Always keep at least the latest message
            if (trimmedContext.length <= 1) break;

            // Remove oldest non-system message
            const nonSystemIndex = trimmedContext.findIndex(msg => msg.role !== 'system');
            if (nonSystemIndex === -1) break;

            const removed = trimmedContext.splice(nonSystemIndex, 1)[0];
            const removedTokens = Math.ceil((removed.content.length * TOKENS_PER_CHAR) + 4);
            totalTokens -= removedTokens;

            if (totalTokens <= MAX_CONTEXT_TOKENS) {
                break;
            }
        }

        return trimmedContext;
    }

    /**
     * Get chat history for user
     */
    static async getChatHistory(userId: string, limit: number = 50): Promise<ChatMessage[]> {
        const [rows] = await pool.execute(
            `SELECT * FROM ai_chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ${parseInt(String(limit))}`,
            [userId]
        );

        return rows as ChatMessage[];
    }

    /**
     * Generate tags for a photo
     */
    static async generateTags(photoId: string): Promise<string[]> {
        const analysis = await this.findByPhotoId(photoId);

        if (!analysis || !analysis.analysis_data.tags) {
            return [];
        }

        return analysis.analysis_data.tags;
    }

    /**
     * Mock analysis data for testing without API key
     */
    private static mockAnalysisData(photoUrl: string): AIAnalysis['analysis_data'] {
        return {
            tags: ['nature', 'landscape', 'outdoor', 'scenic', 'photography'],
            description: 'A beautiful landscape photo showing mountains and trees.',
            objects: [
                { name: 'mountain', confidence: 0.98 },
                { name: 'tree', confidence: 0.95 },
                { name: 'sky', confidence: 0.99 }
            ],
            colors: [
                { color: '#4287f5', percentage: 0.3 },
                { color: '#42f54e', percentage: 0.4 },
                { color: '#f5f542', percentage: 0.2 },
                { color: '#ffffff', percentage: 0.1 }
            ]
        };
    }

    /**
     * Mock chat response for testing without API key
     */
    private static mockChatResponse(message: string): string {
        const responses = [
            'That\'s a great question about your photo! The lighting in this image creates a wonderful atmosphere.',
            'I can see why you like this photo. The composition is very well balanced.',
            'This photo has excellent detail. I particularly like how you\'ve captured the textures.',
            'The colors in this photo are quite striking. I especially love the contrast between the warm and cool tones.',
            'Your photo reminds me of classic landscape photography. The depth of field is perfect.',
            'This is a beautiful moment captured. The timing is excellent.',
            'I appreciate the creativity in this shot. The unique angle adds interest.',
            'The subject of this photo is compelling. It draws the viewer in immediately.',
            'Your photo has a peaceful quality to it. It conveys emotion very well.',
            'This composition follows the rule of thirds nicely. You have a good eye for photography.'
        ];

        // If the message contains a greeting, respond with a greeting
        if (message.toLowerCase().includes('hello') ||
            message.toLowerCase().includes('hi') ||
            message.toLowerCase().includes('hey')) {
            return 'Hello! I\'m your AI photo assistant. How can I help you with your photos today?';
        }

        // If the message asks about photo quality
        if (message.toLowerCase().includes('good') &&
            (message.toLowerCase().includes('photo') || message.toLowerCase().includes('picture'))) {
            return 'A good photo usually has proper exposure, interesting composition, appropriate focus, and conveys emotion or tells a story. It\'s also important that it\'s technically sharp where needed and has good color balance.';
        }

        // If the message asks about camera settings
        if (message.toLowerCase().includes('settings') ||
            message.toLowerCase().includes('aperture') ||
            message.toLowerCase().includes('shutter speed')) {
            return 'Camera settings depend on the situation. For landscapes, try f/11 aperture, low ISO, and a tripod for sharpness. For portraits, f/2.8 creates nice background blur. Fast-moving subjects need faster shutter speeds like 1/500. Experiment to find what works best!';
        }

        // Otherwise return a random response
        return responses[Math.floor(Math.random() * responses.length)];
    }
} 
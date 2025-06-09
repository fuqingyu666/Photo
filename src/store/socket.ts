import { defineStore } from 'pinia';
import { ref } from 'vue';
import { io, Socket } from 'socket.io-client';

/**
 * Socket.io状态管理
 * 用于全局管理WebSocket连接，实现实时通信功能
 */
export const useSocketStore = defineStore('socket', () => {
    // Socket.io实例
    const socket = ref<Socket | null>(null);
    const isConnected = ref(false);
    const connectionError = ref<string | null>(null);

    // 服务器地址
    const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    /**
     * 建立WebSocket连接
     * 创建与服务器的实时通信通道
     * @returns 连接是否成功
     */
    const connect = async (): Promise<boolean> => {
        try {
            if (socket.value?.connected) {
                return true;
            }

            // 创建Socket.io实例，配置重连和传输方式
            socket.value = io(serverUrl, {
                reconnectionDelayMax: 10000, // 最大重连延迟10秒
                transports: ['websocket', 'polling'] // 首选WebSocket，降级使用轮询
            });

            return new Promise((resolve) => {
                // 监听连接成功事件
                socket.value?.on('connect', () => {
                    console.log('Socket.io已连接');
                    isConnected.value = true;
                    connectionError.value = null;
                    resolve(true);
                });

                // 监听连接错误事件
                socket.value?.on('connect_error', (error) => {
                    console.error('Socket.io连接错误:', error);
                    connectionError.value = error.message;
                    isConnected.value = false;
                    resolve(false);
                });

                // 监听断开连接事件
                socket.value?.on('disconnect', () => {
                    console.log('Socket.io已断开连接');
                    isConnected.value = false;
                });
            });
        } catch (error: any) {
            console.error('Socket.io初始化错误:', error);
            connectionError.value = error.message;
            isConnected.value = false;
            return false;
        }
    };

    /**
     * 确保WebSocket连接已建立
     * 组件使用WebSocket前调用此方法确保连接可用
     * @returns 连接是否可用
     */
    const ensureConnection = async (): Promise<boolean> => {
        if (socket.value?.connected) {
            return true;
        }

        return await connect();
    };

    /**
     * 断开WebSocket连接
     * 在不需要实时通信或用户退出时调用，释放资源
     */
    const disconnect = () => {
        if (socket.value) {
            socket.value.disconnect();
            socket.value = null;
            isConnected.value = false;
        }
    };

    return {
        socket,
        isConnected,
        connectionError,
        connect,
        ensureConnection,
        disconnect
    };
}); 
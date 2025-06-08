import { defineStore } from 'pinia';
import { ref } from 'vue';
import { io, Socket } from 'socket.io-client';

export const useSocketStore = defineStore('socket', () => {
    // Socket.io实例
    const socket = ref<Socket | null>(null);
    const isConnected = ref(false);
    const connectionError = ref<string | null>(null);

    // 服务器地址
    const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    // 建立连接
    const connect = async (): Promise<boolean> => {
        try {
            if (socket.value?.connected) {
                return true;
            }

            socket.value = io(serverUrl, {
                reconnectionDelayMax: 10000,
                transports: ['websocket', 'polling']
            });

            return new Promise((resolve) => {
                socket.value?.on('connect', () => {
                    console.log('Socket.io connected');
                    isConnected.value = true;
                    connectionError.value = null;
                    resolve(true);
                });

                socket.value?.on('connect_error', (error) => {
                    console.error('Socket.io connection error:', error);
                    connectionError.value = error.message;
                    isConnected.value = false;
                    resolve(false);
                });

                socket.value?.on('disconnect', () => {
                    console.log('Socket.io disconnected');
                    isConnected.value = false;
                });
            });
        } catch (error: any) {
            console.error('Socket.io initialization error:', error);
            connectionError.value = error.message;
            isConnected.value = false;
            return false;
        }
    };

    // 确保连接已建立
    const ensureConnection = async (): Promise<boolean> => {
        if (socket.value?.connected) {
            return true;
        }

        return await connect();
    };

    // 断开连接
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
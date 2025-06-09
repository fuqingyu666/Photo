import { ref, onMounted, onUnmounted } from 'vue'
import { onConnectionChange } from '../utils/websocket'

/**
 * 用于监控WebSocket连接状态的Hook
 */
export function useWebSocketStatus() {
    const isConnected = ref(false)

    // 连接状态监听器
    const connectionListener = (connected: boolean) => {
        isConnected.value = connected
    }

    // 组件挂载时设置监听器
    onMounted(() => {
        onConnectionChange(connectionListener)
    })

    // 组件卸载时清理监听器
    onUnmounted(() => {
        // WebSocket服务目前没有removeConnectionListener方法，
        // 但我们添加这段代码是为了未来的扩展性
        if (typeof onConnectionChange === 'function') {
            // 在实际实现中，我们会调用类似这样的方法：
            // removeConnectionListener(connectionListener)
        }
    })

    return {
        isConnected
    }
} 
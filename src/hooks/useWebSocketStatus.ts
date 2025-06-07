import { ref, onMounted, onUnmounted } from 'vue'
import { onConnectionChange } from '../utils/websocket'

/**
 * Hook to monitor WebSocket connection status
 */
export function useWebSocketStatus() {
    const isConnected = ref(false)

    // Connection status listener
    const connectionListener = (connected: boolean) => {
        isConnected.value = connected
    }

    // Set up listener when component mounts
    onMounted(() => {
        onConnectionChange(connectionListener)
    })

    // Clean up listener when component unmounts
    onUnmounted(() => {
        // The WebSocket service doesn't currently have a removeConnectionListener method,
        // but we're adding this for future-proofing
        if (typeof onConnectionChange === 'function') {
            // In a real implementation, we would call something like:
            // removeConnectionListener(connectionListener)
        }
    })

    return {
        isConnected
    }
} 
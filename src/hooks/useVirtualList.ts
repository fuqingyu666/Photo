import { ref, computed, onMounted, onBeforeUnmount, Ref } from 'vue'

export interface VirtualListOptions<T> {
    // Data list
    list: Ref<T[]>
    // Item height (px)
    itemHeight: number
    // Container height (px)
    containerHeight?: number
    // Buffer item count (render additional items)
    bufferSize?: number
}

export interface VirtualListState<T> {
    // Container element ref
    containerRef: Ref<HTMLElement | null>
    // Visible items
    visibleItems: Ref<T[]>
    // Total list height
    totalHeight: Ref<number>
    // Offset for visible items
    offsetY: Ref<number>
    // Handle scroll event
    onScroll: (e: Event) => void
}

/**
 * Virtual list hook
 * @param options Virtual list options
 */
export function useVirtualList<T>(options: VirtualListOptions<T>): VirtualListState<T> {
    const { list, itemHeight, containerHeight = 500, bufferSize = 5 } = options

    const containerRef = ref<HTMLElement | null>(null)
    const scrollTop = ref(0)

    // Calculate visible item range
    const visibleRange = computed(() => {
        if (!containerRef.value) {
            return { start: 0, end: 10 }
        }

        const currentHeight = containerRef.value.clientHeight || containerHeight

        // Start index
        let start = Math.floor(scrollTop.value / itemHeight) - bufferSize
        start = Math.max(0, start)

        // End index
        let end = Math.ceil((scrollTop.value + currentHeight) / itemHeight) + bufferSize
        end = Math.min(list.value.length, end)

        return { start, end }
    })

    // Get visible items
    const visibleItems = computed(() => {
        const { start, end } = visibleRange.value
        return list.value.slice(start, end)
    })

    // Calculate total height
    const totalHeight = computed(() => {
        return list.value.length * itemHeight
    })

    // Calculate offset for visible items
    const offsetY = computed(() => {
        return visibleRange.value.start * itemHeight
    })

    // Handle scroll
    const onScroll = (e: Event) => {
        if (e.target) {
            scrollTop.value = (e.target as HTMLElement).scrollTop
        }
    }

    // Add scroll event listener
    const addScrollListener = () => {
        containerRef.value?.addEventListener('scroll', onScroll)
    }

    // Remove scroll event listener
    const removeScrollListener = () => {
        containerRef.value?.removeEventListener('scroll', onScroll)
    }

    // Set up and clean up
    onMounted(() => {
        addScrollListener()
    })

    onBeforeUnmount(() => {
        removeScrollListener()
    })

    return {
        containerRef,
        visibleItems,
        totalHeight,
        offsetY,
        onScroll
    }
}

export default useVirtualList 
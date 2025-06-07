import { ref, computed, onMounted, onBeforeUnmount, Ref, nextTick, watch } from 'vue'

export interface VirtualListOptions<T> {
    // Data list
    list: Ref<T[]>
    // Item height (px) - can be a fixed number or a function that returns the height for a specific item
    itemHeight: number | ((item: T, index: number) => number)
    // Container height (px)
    containerHeight?: number
    // Buffer item count (render additional items)
    bufferSize?: number
    // Key extractor function
    keyExtractor?: (item: T, index: number) => string | number
    // Whether to dynamically adjust the item heights
    dynamicItemHeight?: boolean
}

export interface VirtualListState<T> {
    // Container element ref
    containerRef: Ref<HTMLElement | null>
    // Visible items
    visibleItems: Ref<T[]>
    // Visible item indices
    visibleIndices: Ref<{ start: number; end: number }>
    // Total list height
    totalHeight: Ref<number>
    // Offset for visible items
    offsetY: Ref<number>
    // Handle scroll event
    onScroll: (e: Event) => void
    // Check if item is visible
    isItemVisible: (index: number) => boolean
    // Scroll to specific item
    scrollToItem: (index: number, behavior?: ScrollBehavior) => void
    // Refresh list calculations
    refreshList: () => void
}

/**
 * Virtual list hook
 * @param options Virtual list options
 */
export function useVirtualList<T>(options: VirtualListOptions<T>): VirtualListState<T> {
    const {
        list,
        itemHeight: rawItemHeight,
        containerHeight = 500,
        bufferSize = 5,
        keyExtractor = (_, index) => index,
        dynamicItemHeight = false
    } = options

    const containerRef = ref<HTMLElement | null>(null)
    const scrollTop = ref(0)
    const itemHeights = ref<Map<number, number>>(new Map())
    const itemPositions = ref<{ top: number; bottom: number }[]>([])

    // Get item height for an item
    const getItemHeight = (item: T, index: number): number => {
        if (typeof rawItemHeight === 'function') {
            return rawItemHeight(item, index)
        }

        if (dynamicItemHeight) {
            return itemHeights.value.get(index) || rawItemHeight as number
        }

        return rawItemHeight as number
    }

    // Calculate item positions
    const calculateItemPositions = () => {
        const positions: { top: number; bottom: number }[] = []
        let top = 0

        for (let i = 0; i < list.value.length; i++) {
            const height = getItemHeight(list.value[i], i)
            const bottom = top + height
            positions.push({ top, bottom })
            top = bottom
        }

        itemPositions.value = positions
    }

    // Recalculate when list changes
    watch(() => list.value.length, () => {
        calculateItemPositions()
    })

    // Calculate visible item range
    const visibleRange = computed(() => {
        if (!containerRef.value) {
            return { start: 0, end: 10 }
        }

        const currentHeight = containerRef.value.clientHeight || containerHeight
        let start = 0
        let end = list.value.length - 1

        if (dynamicItemHeight && itemPositions.value.length > 0) {
            // Binary search for start index with dynamic heights
            start = binarySearchForStart(scrollTop.value)
            end = binarySearchForEnd(scrollTop.value + currentHeight)
        } else {
            // Simple calculation for fixed heights
            const avgItemHeight = typeof rawItemHeight === 'number' ? rawItemHeight : 50
            start = Math.floor(scrollTop.value / avgItemHeight) - bufferSize
            end = Math.ceil((scrollTop.value + currentHeight) / avgItemHeight) + bufferSize
        }

        // Apply buffer and clamp values
        start = Math.max(0, start - bufferSize)
        end = Math.min(list.value.length, end + bufferSize)

        return { start, end }
    })

    // Binary search to find start index
    const binarySearchForStart = (scrollTop: number): number => {
        const positions = itemPositions.value
        if (positions.length === 0) return 0

        let low = 0
        let high = positions.length - 1
        let mid = 0

        while (low <= high) {
            mid = Math.floor((low + high) / 2)

            if (positions[mid].bottom < scrollTop) {
                low = mid + 1
            } else if (positions[mid].top > scrollTop) {
                high = mid - 1
            } else {
                return mid
            }
        }

        return low > 0 ? low - 1 : 0
    }

    // Binary search to find end index
    const binarySearchForEnd = (scrollBottom: number): number => {
        const positions = itemPositions.value
        if (positions.length === 0) return 0

        let low = 0
        let high = positions.length - 1
        let mid = 0

        while (low <= high) {
            mid = Math.floor((low + high) / 2)

            if (positions[mid].top > scrollBottom) {
                high = mid - 1
            } else if (positions[mid].bottom < scrollBottom) {
                low = mid + 1
            } else {
                return mid
            }
        }

        return Math.min(low, positions.length - 1)
    }

    // Get visible items
    const visibleItems = computed(() => {
        const { start, end } = visibleRange.value
        return list.value.slice(start, end)
    })

    // Calculate total height
    const totalHeight = computed(() => {
        if (dynamicItemHeight && itemPositions.value.length > 0) {
            const lastItem = itemPositions.value[itemPositions.value.length - 1]
            return lastItem ? lastItem.bottom : 0
        }

        return list.value.reduce((total, item, index) => {
            return total + getItemHeight(item, index)
        }, 0)
    })

    // Calculate offset for visible items
    const offsetY = computed(() => {
        const { start } = visibleRange.value

        if (dynamicItemHeight && itemPositions.value.length > 0 && start > 0) {
            return itemPositions.value[start].top
        }

        if (typeof rawItemHeight === 'number') {
            return start * rawItemHeight
        }

        let offset = 0
        for (let i = 0; i < start; i++) {
            offset += getItemHeight(list.value[i], i)
        }

        return offset
    })

    // Update item heights after rendering
    const updateItemHeights = async () => {
        if (!dynamicItemHeight || !containerRef.value) return

        await nextTick()

        const items = containerRef.value.querySelectorAll('.virtual-list-item')
        let shouldRecalculate = false

        items.forEach((item, i) => {
            const index = visibleRange.value.start + i
            const height = item.getBoundingClientRect().height
            const currentHeight = itemHeights.value.get(index) || 0

            if (height > 0 && height !== currentHeight) {
                itemHeights.value.set(index, height)
                shouldRecalculate = true
            }
        })

        if (shouldRecalculate) {
            calculateItemPositions()
        }
    }

    // Handle scroll
    const onScroll = (e: Event) => {
        if (e.target) {
            scrollTop.value = (e.target as HTMLElement).scrollTop
            if (dynamicItemHeight) {
                requestAnimationFrame(() => {
                    updateItemHeights()
                })
            }
        }
    }

    // Check if item is visible
    const isItemVisible = (index: number): boolean => {
        const { start, end } = visibleRange.value
        return index >= start && index < end
    }

    // Scroll to specific item
    const scrollToItem = (index: number, behavior: ScrollBehavior = 'auto') => {
        if (!containerRef.value || index < 0 || index >= list.value.length) return

        let top = 0

        if (dynamicItemHeight && itemPositions.value.length > 0) {
            top = itemPositions.value[index].top
        } else {
            for (let i = 0; i < index; i++) {
                top += getItemHeight(list.value[i], i)
            }
        }

        containerRef.value.scrollTo({
            top,
            behavior
        })
    }

    // Refresh list calculations
    const refreshList = async () => {
        itemHeights.value = new Map()
        await nextTick()
        calculateItemPositions()
    }

    // Add resize observer
    const setupResizeObserver = () => {
        if (window.ResizeObserver && containerRef.value) {
            const resizeObserver = new ResizeObserver(() => {
                requestAnimationFrame(() => {
                    if (dynamicItemHeight) {
                        refreshList()
                    }
                })
            })

            resizeObserver.observe(containerRef.value)

            // Clean up observer
            onBeforeUnmount(() => {
                resizeObserver.disconnect()
            })
        }
    }

    // Add scroll event listener
    const addScrollListener = () => {
        containerRef.value?.addEventListener('scroll', onScroll, { passive: true })
    }

    // Remove scroll event listener
    const removeScrollListener = () => {
        containerRef.value?.removeEventListener('scroll', onScroll)
    }

    // Set up and clean up
    onMounted(() => {
        addScrollListener()
        calculateItemPositions()
        setupResizeObserver()
    })

    onBeforeUnmount(() => {
        removeScrollListener()
    })

    return {
        containerRef,
        visibleItems,
        visibleIndices: visibleRange,
        totalHeight,
        offsetY,
        onScroll,
        isItemVisible,
        scrollToItem,
        refreshList
    }
}

export default useVirtualList 
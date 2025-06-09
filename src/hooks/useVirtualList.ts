import { ref, computed, onMounted, onBeforeUnmount, Ref, nextTick, watch } from 'vue'

/**
 * 虚拟列表选项接口
 * 定义虚拟列表的配置参数
 */
export interface VirtualListOptions<T> {
    // 数据列表
    list: Ref<T[]>
    // 项目高度(像素) - 可以是固定数字或返回特定项目高度的函数
    itemHeight: number | ((item: T, index: number) => number)
    // 容器高度(像素)
    containerHeight?: number
    // 缓冲项数量(额外渲染的项目数)
    bufferSize?: number
    // 键值提取函数
    keyExtractor?: (item: T, index: number) => string | number
    // 是否动态调整项目高度
    dynamicItemHeight?: boolean
}

/**
 * 虚拟列表状态接口
 * 定义虚拟列表的返回值
 */
export interface VirtualListState<T> {
    // 容器元素引用
    containerRef: Ref<HTMLElement | null>
    // 可见项目
    visibleItems: Ref<T[]>
    // 可见项目索引范围
    visibleIndices: Ref<{ start: number; end: number }>
    // 列表总高度
    totalHeight: Ref<number>
    // 可见项目的偏移量
    offsetY: Ref<number>
    // 处理滚动事件
    onScroll: (e: Event) => void
    // 检查项目是否可见
    isItemVisible: (index: number) => boolean
    // 滚动到特定项目
    scrollToItem: (index: number, behavior?: ScrollBehavior) => void
    // 刷新列表计算
    refreshList: () => void
}

/**
 * 虚拟列表钩子函数
 * 实现虚拟滚动，只渲染可视区域内的项目，大幅提高长列表性能
 * @param options 虚拟列表选项
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

    // 容器引用和滚动状态
    const containerRef = ref<HTMLElement | null>(null)
    const scrollTop = ref(0)
    // 存储每个项目的实际高度
    const itemHeights = ref<Map<number, number>>(new Map())
    // 存储每个项目的位置信息(顶部和底部坐标)
    const itemPositions = ref<{ top: number; bottom: number }[]>([])

    /**
     * 获取项目高度
     * 根据配置选择固定高度或动态计算高度
     * @param item 项目数据
     * @param index 项目索引
     */
    const getItemHeight = (item: T, index: number): number => {
        if (typeof rawItemHeight === 'function') {
            return rawItemHeight(item, index)
        }

        if (dynamicItemHeight) {
            return itemHeights.value.get(index) || rawItemHeight as number
        }

        return rawItemHeight as number
    }

    /**
     * 计算项目位置
     * 为每个项目计算其在列表中的顶部和底部位置
     */
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

    // 列表数据变化时重新计算位置
    watch(() => list.value.length, () => {
        calculateItemPositions()
    })

    /**
     * 计算可见项目范围
     * 根据当前滚动位置确定应该渲染哪些项目
     */
    const visibleRange = computed(() => {
        if (!containerRef.value) {
            return { start: 0, end: 10 }
        }

        const currentHeight = containerRef.value.clientHeight || containerHeight
        let start = 0
        let end = list.value.length - 1

        if (dynamicItemHeight && itemPositions.value.length > 0) {
            // 使用二分查找确定起始索引(动态高度)
            start = binarySearchForStart(scrollTop.value)
            end = binarySearchForEnd(scrollTop.value + currentHeight)
        } else {
            // 简单计算固定高度
            const avgItemHeight = typeof rawItemHeight === 'number' ? rawItemHeight : 50
            start = Math.floor(scrollTop.value / avgItemHeight) - bufferSize
            end = Math.ceil((scrollTop.value + currentHeight) / avgItemHeight) + bufferSize
        }

        // 应用缓冲区并限制值范围
        start = Math.max(0, start - bufferSize)
        end = Math.min(list.value.length, end + bufferSize)

        return { start, end }
    })

    /**
     * 二分查找起始索引
     * 快速定位滚动位置对应的列表项索引
     * @param scrollTop 滚动顶部位置
     */
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

    /**
     * 二分查找结束索引
     * 快速定位滚动底部位置对应的列表项索引
     * @param scrollBottom 滚动底部位置
     */
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

    // 获取可见项目
    const visibleItems = computed(() => {
        const { start, end } = visibleRange.value
        return list.value.slice(start, end)
    })

    /**
     * 计算列表总高度
     * 用于设置容器内部包装器的高度，确保滚动条正确显示
     */
    const totalHeight = computed(() => {
        if (dynamicItemHeight && itemPositions.value.length > 0) {
            const lastItem = itemPositions.value[itemPositions.value.length - 1]
            return lastItem ? lastItem.bottom : 0
        }

        return list.value.reduce((total, item, index) => {
            return total + getItemHeight(item, index)
        }, 0)
    })

    /**
     * 计算可见项目的偏移量
     * 确定可见项目在列表中的正确位置
     */
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

    /**
     * 更新项目高度
     * 在渲染后测量实际DOM高度，更新动态高度配置
     */
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

    /**
     * 处理滚动事件
     * 更新滚动位置并触发动态高度更新
     */
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

    /**
     * 检查项目是否可见
     * 判断指定索引的项目是否在可视范围内
     */
    const isItemVisible = (index: number): boolean => {
        const { start, end } = visibleRange.value
        return index >= start && index < end
    }

    /**
     * 滚动到特定项目
     * 将视图移动到指定项目的位置
     * @param index 目标项目索引
     * @param behavior 滚动行为(平滑或即时)
     */
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

    /**
     * 刷新列表计算
     * 重置所有高度缓存并重新计算位置
     */
    const refreshList = async () => {
        itemHeights.value = new Map()
        await nextTick()
        calculateItemPositions()
    }

    /**
     * 设置调整大小观察器
     * 监听容器大小变化，自动重新计算列表
     */
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

            // 清理观察器
            onBeforeUnmount(() => {
                resizeObserver.disconnect()
            })
        }
    }

    /**
     * 添加滚动事件监听器
     */
    const addScrollListener = () => {
        containerRef.value?.addEventListener('scroll', onScroll, { passive: true })
    }

    /**
     * 移除滚动事件监听器
     */
    const removeScrollListener = () => {
        containerRef.value?.removeEventListener('scroll', onScroll)
    }

    // 设置和清理
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
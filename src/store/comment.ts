import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { getPhotoComments, createComment, deleteComment, Comment } from '../api/comment';
import { useSocketStore } from './socket';
import { useAuthStore } from './auth';

export const useCommentStore = defineStore('comment', () => {
    // 状态
    const comments = ref<Comment[]>([]);
    const loading = ref<boolean>(false);
    const error = ref<string | null>(null);
    const currentPhotoId = ref<string | null>(null);

    // Socket连接
    const socketStore = useSocketStore();
    const authStore = useAuthStore();

    // 初始化时加载已保存的游客评论
    const loadPersistedComments = (photoId: string) => {
        const persistedComments = localStorage.getItem(`guest_comments_${photoId}`);
        if (persistedComments) {
            try {
                const guestComments = JSON.parse(persistedComments);
                return guestComments;
            } catch (e) {
                console.error('Error parsing persisted comments', e);
                return [];
            }
        }
        return [];
    };

    // Save guest comments to localStorage
    const persistGuestComments = (photoId: string, commentsList: Comment[]) => {
        const guestComments = commentsList.filter(c => c.user_id === 'guest');
        if (guestComments.length > 0) {
            localStorage.setItem(`guest_comments_${photoId}`, JSON.stringify(guestComments));
        }
    };

    // Watch for changes to comments and persist guest comments
    watch(comments, (newComments) => {
        if (currentPhotoId.value) {
            persistGuestComments(currentPhotoId.value, newComments);
        }
    }, { deep: true });

    /**
     * Connect to WebSocket for photo comments
     */
    const connectToPhotoRoom = (photoId: string) => {
        if (!socketStore.socket) return;

        // Set current photo ID
        currentPhotoId.value = photoId;

        // Join photo room
        socketStore.socket.emit('join-photo-room', photoId);

        // Listen for new comments
        socketStore.socket.on('new-comment', (comment: Comment) => {
            if (comment.photo_id === currentPhotoId.value) {
                addComment(comment);
            }
        });

        // Listen for comment deletions
        socketStore.socket.on('delete-comment', (data: { commentId: string }) => {
            removeComment(data.commentId);
        });
    };

    /**
     * Disconnect from WebSocket
     */
    const disconnectFromPhotoRoom = () => {
        if (!socketStore.socket || !currentPhotoId.value) return;

        // Remove socket listeners
        socketStore.socket.off('new-comment');
        socketStore.socket.off('delete-comment');

        // Clear current photo ID
        currentPhotoId.value = null;
    };

    /**
     * Load comments for a photo
     */
    const loadComments = async (photoId: string) => {
        loading.value = true;
        error.value = null;

        try {
            const photoComments = await getPhotoComments(photoId);

            // Load guest comments from localStorage and merge them with API comments
            const guestComments = loadPersistedComments(photoId);

            // Merge both comment sources
            comments.value = [...photoComments, ...guestComments];
        } catch (err: any) {
            error.value = err.message || 'Failed to load comments';
            // Even if API call fails, try to load guest comments
            comments.value = loadPersistedComments(photoId);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Add a new comment
     */
    const addComment = async (comment: Comment) => {
        // Check if comment already exists
        if (!comments.value.find(c => c.id === comment.id)) {
            comments.value = [comment, ...comments.value];
        }
    };

    /**
     * Post a new comment
     */
    const postComment = async (photoId: string, content: string): Promise<boolean> => {
        loading.value = true;
        error.value = null;

        try {
            // 如果用户未登录，使用默认用户信息
            if (!authStore.isLoggedIn) {
                // 添加一个本地评论
                const tempComment: Comment = {
                    id: `temp-${Date.now()}`,
                    photo_id: photoId,
                    user_id: 'guest',
                    content: content,
                    created_at: new Date().toISOString(),
                    username: '游客'
                };

                // 添加到本地评论列表
                addComment(tempComment);
                return true;
            }

            // 正常API调用（已登录用户）
            const newComment = await createComment(photoId, content);
            if (newComment) {
                // WebSocket will handle adding the comment to the state
                return true;
            }
            return false;
        } catch (err: any) {
            error.value = err.message || 'Failed to post comment';
            return false;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Remove a comment
     */
    const removeComment = (commentId: string) => {
        comments.value = comments.value.filter(c => c.id !== commentId);
    };

    /**
     * Delete a comment
     */
    const removeUserComment = async (photoId: string, commentId: string): Promise<boolean> => {
        loading.value = true;
        error.value = null;

        try {
            // 处理临时评论的删除
            if (commentId.startsWith('temp-')) {
                removeComment(commentId);
                return true;
            }

            // 正常API删除评论
            const success = await deleteComment(photoId, commentId);
            if (success) {
                // WebSocket will handle removing the comment from the state
                return true;
            }
            return false;
        } catch (err: any) {
            error.value = err.message || 'Failed to delete comment';
            return false;
        } finally {
            loading.value = false;
        }
    };

    return {
        comments,
        loading,
        error,
        currentPhotoId,
        connectToPhotoRoom,
        disconnectFromPhotoRoom,
        loadComments,
        postComment,
        removeUserComment
    };
}); 
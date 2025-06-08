import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        redirect: '/home'
    },
    {
        path: '/login',
        name: 'Login',
        component: () => import('../views/Login.vue'),
        meta: {
            title: 'Login',
            requiresAuth: false
        }
    },
    {
        path: '/register',
        name: 'Register',
        component: () => import('../views/Register.vue'),
        meta: {
            title: 'Register',
            requiresAuth: false
        }
    },
    {
        path: '/home',
        name: 'Home',
        component: () => import('../views/Home.vue'),
        meta: {
            title: 'Home',
            requiresAuth: true
        }
    },
    {
        path: '/upload',
        name: 'Upload',
        component: () => import('../views/Upload.vue'),
        meta: {
            title: 'Upload',
            requiresAuth: true
        }
    },
    {
        path: '/shared',
        name: 'Shared',
        component: () => import('../views/Shared.vue'),
        meta: {
            title: 'Shared',
            requiresAuth: true
        }
    },
    {
        path: '/detail/:id',
        name: 'Detail',
        component: () => import('../views/Detail.vue'),
        meta: {
            title: 'Detail',
            requiresAuth: true
        }
    },
    {
        path: '/ai-chat',
        name: 'AiChat',
        component: () => import('../views/AiChat.vue'),
        meta: {
            title: 'AI Chat',
            requiresAuth: true
        }
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: () => import('../views/NotFound.vue')
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

router.beforeEach((to, from, next) => {
    // Set the page title
    document.title = `${to.meta.title} - 相册共享云平台` || '相册共享云平台'

    // Check if the route requires authentication
    if (to.meta.requiresAuth) {
        // Mock auth check - in a real app, check token validity
        const token = localStorage.getItem('token')
        if (!token) {
            next({ name: 'Login' })
            return
        }
    }
    next()
})

export default router 
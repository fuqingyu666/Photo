import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
// 预加载共享照片详情组件 - 这个组件不使用懒加载，直接导入
import SharedPhotoDetail from '../views/SharedPhotoDetail.vue'

/**
 * 路由配置
 * 大部分路由使用懒加载模式，只有在访问对应路由时才会加载相关组件
 * 懒加载使用 () => import() 语法实现，可显著减少首屏加载时间
 */
const routes: RouteRecordRaw[] = [
    {
        path: '/',
        redirect: '/home'
    },
    {
        path: '/login',
        name: 'Login',
        // 路由懒加载：使用动态导入，仅在用户访问登录页时才加载此组件
        component: () => import('../views/Login.vue'),
        meta: {
            title: '登录',
            requiresAuth: false
        }
    },
    {
        path: '/register',
        name: 'Register',
        // 路由懒加载：注册页组件
        component: () => import('../views/Register.vue'),
        meta: {
            title: '注册',
            requiresAuth: false
        }
    },
    {
        path: '/home',
        name: 'Home',
        // 路由懒加载：首页组件
        component: () => import('../views/Home.vue'),
        meta: {
            title: '首页',
            requiresAuth: true
        }
    },
    {
        path: '/upload',
        name: 'Upload',
        // 路由懒加载：上传页组件
        component: () => import('../views/Upload.vue'),
        meta: {
            title: '上传',
            requiresAuth: true
        }
    },
    {
        path: '/shared',
        name: 'Shared',
        // 路由懒加载：分享页组件
        component: () => import('../views/Shared.vue'),
        meta: {
            title: '已分享',
            requiresAuth: true
        }
    },
    {
        path: '/detail/:id',
        name: 'Detail',
        // 路由懒加载：详情页组件
        component: () => import('../views/Detail.vue'),
        meta: {
            title: '照片详情',
            requiresAuth: true
        }
    },
    {
        path: '/shared-photo/:id',
        name: 'SharedPhotoDetail',
        // 非懒加载：此组件直接导入，因为它是高频访问页面，预加载可提升用户体验
        component: SharedPhotoDetail,
        meta: {
            title: '照片详情',
            requiresAuth: true
        }
    },
    {
        path: '/ai-chat',
        name: 'AiChat',
        // 路由懒加载：AI聊天组件，通常较大，适合懒加载
        component: () => import('../views/AiChat.vue'),
        meta: {
            title: 'AI聊天',
            requiresAuth: true
        }
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        // 路由懒加载：404页面
        component: () => import('../views/NotFound.vue')
    }
]

/**
 * 创建路由实例
 * 使用HTML5历史模式，提供更好的URL格式
 */
const router = createRouter({
    history: createWebHistory(),
    routes
})

/**
 * 全局路由守卫
 * 在路由切换前执行，用于权限控制和页面标题设置
 */
router.beforeEach((to, from, next) => {
    // 设置页面标题
    document.title = `${to.meta.title} - 相册共享云平台` || '相册共享云平台'

    // 检查路由是否需要身份验证
    if (to.meta.requiresAuth) {
        // 身份验证检查 - 在实际应用中，应检查令牌有效性
        const token = localStorage.getItem('token')
        if (!token) {
            next({ name: 'Login' })
            return
        }
    }
    next()
})

export default router 
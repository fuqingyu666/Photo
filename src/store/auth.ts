import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as authApi from '../api/auth'

/**
 * 用户信息接口
 * 定义存储在状态中的用户基本信息
 */
interface User {
    id: string           // 用户唯一标识
    username: string     // 用户名
    email: string        // 电子邮件
    avatar?: string      // 头像URL（可选）
}

/**
 * 登录表单接口
 * 定义登录时需要的表单字段
 */
interface LoginForm {
    username: string     // 用户名
    password: string     // 密码
}

/**
 * 注册表单接口
 * 定义注册时需要的表单字段
 */
interface RegisterForm {
    username: string     // 用户名
    email: string        // 电子邮件
    password: string     // 密码
    confirmPassword: string  // 确认密码
}

/**
 * 认证状态管理
 * 使用Pinia管理用户认证状态，包括登录、注册、注销等功能
 * 这个store在整个应用中被广泛使用，用于判断用户是否已登录、获取用户信息等
 */
export const useAuthStore = defineStore('auth', () => {
    // 状态定义
    const user = ref<User | null>(null)                             // 当前用户信息
    const token = ref<string | null>(localStorage.getItem('token')) // 认证令牌
    const loading = ref(false)                                      // 加载状态
    const error = ref('')                                           // 错误信息

    /**
     * 初始化用户信息
     * 从localStorage中加载之前保存的用户信息
     * 在store创建时自动调用
     */
    const initializeUser = () => {
        const storedUser = localStorage.getItem('user')
        if (storedUser) {
            user.value = JSON.parse(storedUser)
        }
    }

    /**
     * 用户登录
     * 使用邮箱和密码进行用户认证，成功后更新状态并保存令牌
     * 
     * @param email 用户邮箱
     * @param password 用户密码 
     * @param rememberMe 是否记住邮箱（用于下次自动填充）
     * @returns 登录是否成功
     */
    const login = async (email: string, password: string, rememberMe: boolean = false) => {
        loading.value = true
        error.value = ''

        try {
            // 调用API进行登录
            const response = await authApi.login({ email, password })

            // 成功后保存用户信息和令牌到状态中
            user.value = response.user
            token.value = response.token

            // 同时保存到localStorage，确保页面刷新后状态不丢失
            localStorage.setItem('token', response.token)
            localStorage.setItem('user', JSON.stringify(response.user))

            // 如果选择"记住我"，保存邮箱到本地存储
            if (rememberMe) {
                localStorage.setItem('rememberedEmail', email);
            } else {
                localStorage.removeItem('rememberedEmail');
            }

            return true
        } catch (err: any) {
            // 处理登录失败的情况
            if (err.response && err.response.data && err.response.data.error) {
                error.value = err.response.data.error
            } else {
                error.value = '登录失败，请检查您的邮箱和密码'
            }
            return false
        } finally {
            loading.value = false
        }
    }

    /**
     * 用户注册
     * 创建新用户账号，成功后自动登录
     * 
     * @param registerData 包含用户名、邮箱、密码和确认密码的注册数据
     * @returns 注册是否成功
     */
    const register = async (registerData: RegisterForm) => {
        loading.value = true
        error.value = ''

        try {
            // 前端验证：确认两次密码输入是否一致
            if (registerData.password !== registerData.confirmPassword) {
                error.value = '两次输入的密码不匹配'
                return false
            }

            // 移除确认密码字段，准备API请求数据
            const { confirmPassword, ...apiData } = registerData
            const response = await authApi.register(apiData)

            // 成功后保存用户信息和令牌到状态中
            user.value = response.user
            token.value = response.token

            // 同时保存到localStorage
            localStorage.setItem('token', response.token)
            localStorage.setItem('user', JSON.stringify(response.user))

            return true
        } catch (err: any) {
            // 处理注册失败的情况
            if (err.response && err.response.data && err.response.data.error) {
                error.value = err.response.data.error
            } else {
                error.value = '注册失败，请稍后重试'
            }
            return false
        } finally {
            loading.value = false
        }
    }

    /**
     * 用户注销
     * 清除用户信息和令牌，退出当前登录状态
     */
    const logout = () => {
        // 清除内存中的状态
        user.value = null
        token.value = null
        // 清除本地存储的认证信息
        localStorage.removeItem('token')
        localStorage.removeItem('user')
    }

    /**
     * 检查用户是否已认证
     * 根据令牌是否存在判断用户登录状态
     * 
     * @returns 用户是否已登录
     */
    const isAuthenticated = () => {
        return !!token.value
    }

    // 在store创建时初始化用户信息
    initializeUser()

    // 导出状态和方法供组件使用
    return {
        user,           // 当前用户信息
        token,          // 认证令牌
        loading,        // 加载状态
        error,          // 错误信息
        login,          // 登录方法
        register,       // 注册方法
        logout,         // 注销方法
        isAuthenticated // 检查认证状态方法
    }
}) 
import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as authApi from '../api/auth'

interface User {
    id: string
    username: string
    email: string
    avatar?: string
}

interface LoginForm {
    username: string
    password: string
}

interface RegisterForm {
    username: string
    email: string
    password: string
    confirmPassword: string
}

export const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null)
    const token = ref<string | null>(localStorage.getItem('token'))
    const loading = ref(false)
    const error = ref('')

    // Initialize user from localStorage if available
    const initializeUser = () => {
        const storedUser = localStorage.getItem('user')
        if (storedUser) {
            user.value = JSON.parse(storedUser)
        }
    }

    // Login - uses the real API
    const login = async (email: string, password: string, rememberMe: boolean = false) => {
        loading.value = true
        error.value = ''

        try {
            const response = await authApi.login({ email, password })

            // Save to store
            user.value = response.user
            token.value = response.token

            // Save to localStorage
            localStorage.setItem('token', response.token)
            localStorage.setItem('user', JSON.stringify(response.user))

            // Save email if remember me is checked
            if (rememberMe) {
                localStorage.setItem('rememberedEmail', email);
            } else {
                localStorage.removeItem('rememberedEmail');
            }

            return true
        } catch (err: any) {
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

    // Register - uses the real API
    const register = async (registerData: RegisterForm) => {
        loading.value = true
        error.value = ''

        try {
            // Validation
            if (registerData.password !== registerData.confirmPassword) {
                error.value = '两次输入的密码不匹配'
                return false
            }

            const { confirmPassword, ...apiData } = registerData
            const response = await authApi.register(apiData)

            // Save to store
            user.value = response.user
            token.value = response.token

            // Save to localStorage
            localStorage.setItem('token', response.token)
            localStorage.setItem('user', JSON.stringify(response.user))

            return true
        } catch (err: any) {
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

    // Logout
    const logout = () => {
        user.value = null
        token.value = null
        localStorage.removeItem('token')
        localStorage.removeItem('user')
    }

    // Check if user is authenticated
    const isAuthenticated = () => {
        return !!token.value
    }

    // Initialize user on store creation
    initializeUser()

    return {
        user,
        token,
        loading,
        error,
        login,
        register,
        logout,
        isAuthenticated
    }
}) 
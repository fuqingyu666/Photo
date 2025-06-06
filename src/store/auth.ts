import { defineStore } from 'pinia'
import { ref } from 'vue'

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

    // Mock login - in a real app, this would call an API
    const login = async (loginData: LoginForm) => {
        loading.value = true
        error.value = ''

        try {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 800))

            // Mock successful login
            const mockUser: User = {
                id: '123',
                username: loginData.username,
                email: `${loginData.username}@example.com`,
                avatar: 'https://randomuser.me/api/portraits/lego/1.jpg'
            }

            const mockToken = 'mock-jwt-token-' + Math.random().toString(36).substr(2, 9)

            // Save to store
            user.value = mockUser
            token.value = mockToken

            // Save to localStorage
            localStorage.setItem('token', mockToken)
            localStorage.setItem('user', JSON.stringify(mockUser))

            return true
        } catch (err) {
            error.value = 'Login failed. Please check your credentials.'
            return false
        } finally {
            loading.value = false
        }
    }

    // Mock register - in a real app, this would call an API
    const register = async (registerData: RegisterForm) => {
        loading.value = true
        error.value = ''

        try {
            // Validation
            if (registerData.password !== registerData.confirmPassword) {
                error.value = 'Passwords do not match'
                return false
            }

            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1000))

            // Mock successful registration
            const mockUser: User = {
                id: Date.now().toString(),
                username: registerData.username,
                email: registerData.email,
                avatar: 'https://randomuser.me/api/portraits/lego/2.jpg'
            }

            const mockToken = 'mock-jwt-token-' + Math.random().toString(36).substr(2, 9)

            // Save to store
            user.value = mockUser
            token.value = mockToken

            // Save to localStorage
            localStorage.setItem('token', mockToken)
            localStorage.setItem('user', JSON.stringify(mockUser))

            return true
        } catch (err) {
            error.value = 'Registration failed. Please try again.'
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
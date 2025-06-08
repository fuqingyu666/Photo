<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <img src="/favicon.svg" alt="Logo" class="login-logo" />
        <h1 class="login-title">登录</h1>
        <p class="login-subtitle">相册共享云平台</p>
      </div>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="email">邮箱</label>
          <input 
            type="email" 
            id="email" 
            v-model="email" 
            placeholder="请输入邮箱地址" 
            required 
            :class="{'error-input': errors.email}"
          />
          <span v-if="errors.email" class="error-text">{{ errors.email }}</span>
        </div>
        
        <div class="form-group">
          <label for="password">密码</label>
          <div class="password-input-container">
            <input 
              :type="showPassword ? 'text' : 'password'" 
              id="password" 
              v-model="password" 
              placeholder="请输入密码" 
              required 
              :class="{'error-input': errors.password}"
            />
            <button 
              type="button" 
              class="toggle-password" 
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? '隐藏' : '显示' }}
            </button>
          </div>
          <span v-if="errors.password" class="error-text">{{ errors.password }}</span>
        </div>
        
        <div class="form-options">
          <label class="remember-me">
            <input type="checkbox" v-model="rememberMe" />
            <span>记住我</span>
          </label>
          <a href="#" class="forgot-password" @click.prevent="forgotPassword">忘记密码？</a>
        </div>
        
        <button type="submit" class="login-button" :disabled="isLoading">
          {{ isLoading ? '登录中...' : '登录' }}
        </button>
        
        <div v-if="error" class="auth-error">
          {{ error }}
        </div>
      </form>
      
      <div class="login-footer">
        <p>还没有账号？ <router-link to="/register">立即注册</router-link></p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../store/auth';

const router = useRouter();
const authStore = useAuthStore();

// 表单数据
const email = ref('');
const password = ref('');
const rememberMe = ref(false);
const showPassword = ref(false);

// 状态
const isLoading = ref(false);
const error = ref('');
const errors = reactive({
  email: '',
  password: ''
});

// 验证邮箱格式
const validateEmail = () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email.value) {
    errors.email = '邮箱不能为空';
    return false;
  } else if (!emailRegex.test(email.value)) {
    errors.email = '请输入有效的邮箱地址';
    return false;
  }
  errors.email = '';
  return true;
};

// 验证密码
const validatePassword = () => {
  if (!password.value) {
    errors.password = '密码不能为空';
    return false;
  } else if (password.value.length < 6) {
    errors.password = '密码至少需要6个字符';
    return false;
  }
  errors.password = '';
  return true;
};

// 验证表单
const validateForm = () => {
  const isEmailValid = validateEmail();
  const isPasswordValid = validatePassword();
  return isEmailValid && isPasswordValid;
};

// 处理登录
const handleLogin = async () => {
  // 重置错误信息
  error.value = '';
  
  // 验证表单
  if (!validateForm()) {
    return;
  }
  
  isLoading.value = true;
  
  try {
    const result = await authStore.login(email.value, password.value, rememberMe.value);
    if (result) {
      router.push('/home');
    } else {
      error.value = authStore.error || '登录失败，请检查您的邮箱和密码';
    }
  } catch (err: any) {
    if (err.response && err.response.data && err.response.data.message) {
      error.value = err.response.data.message;
    } else {
      error.value = '登录失败，请检查您的邮箱和密码';
    }
    console.error('登录错误:', err);
  } finally {
    isLoading.value = false;
  }
};

// 自动填充存储的邮箱 (如果有)
onMounted(() => {
  const savedEmail = localStorage.getItem('rememberedEmail');
  if (savedEmail) {
    email.value = savedEmail;
    rememberMe.value = true;
  }
});

// 忘记密码功能
const forgotPassword = () => {
  // 这里可以添加忘记密码的逻辑，比如显示一个模态框或导航到忘记密码页面
  alert('该功能暂未实现');
};
</script>

<style scoped lang="scss">
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 20px;
}

.login-card {
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
  padding: 40px;
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
  
  .login-logo {
    width: 60px;
    height: 60px;
    margin-bottom: 16px;
  }
  
  .login-title {
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 8px;
    color: #333;
  }
  
  .login-subtitle {
    font-size: 16px;
    color: #606266;
    margin: 0;
  }
}

.login-form {
  margin-bottom: 24px;
}

.form-group {
  margin-bottom: 20px;
  
  label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    color: #333;
  }
  
  input {
    width: 100%;
    padding: 12px 15px;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
    
    &:focus {
      border-color: #409eff;
    }
    
    &.error-input {
      border-color: #f56c6c;
    }
  }
}

.error-text {
  display: block;
  color: #f56c6c;
  font-size: 12px;
  margin-top: 4px;
}

.password-input-container {
  position: relative;
  
  .toggle-password {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #606266;
    cursor: pointer;
    font-size: 12px;
    
    &:hover {
      color: #409eff;
    }
  }
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  
  .remember-me {
    display: flex;
    align-items: center;
    cursor: pointer;
    
    input {
      margin-right: 6px;
    }
  }
  
  .forgot-password {
    color: #409eff;
    text-decoration: none;
    font-size: 14px;
    
    &:hover {
      text-decoration: underline;
    }
  }
}

.login-button {
  width: 100%;
  padding: 12px;
  background-color: #409eff;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #66b1ff;
  }
  
  &:disabled {
    background-color: #a0cfff;
    cursor: not-allowed;
  }
}

.auth-error {
  text-align: center;
  color: #f56c6c;
  margin-top: 16px;
  font-size: 14px;
}

.login-footer {
  text-align: center;
  font-size: 14px;
  color: #606266;
  
  a {
    color: #409eff;
    text-decoration: none;
    font-weight: 500;
    
    &:hover {
      text-decoration: underline;
    }
  }
}

@media (max-width: 480px) {
  .login-card {
    padding: 30px 20px;
  }
}
</style> 
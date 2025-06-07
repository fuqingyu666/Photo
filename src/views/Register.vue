<template>
  <div class="register-container">
    <div class="register-card">
      <div class="register-header">
        <img src="/favicon.svg" alt="Logo" class="register-logo" />
        <h1 class="register-title">注册</h1>
        <p class="register-subtitle">创建您的账号</p>
      </div>
      
      <form @submit.prevent="handleRegister" class="register-form">
        <div class="form-group">
          <label for="username">用户名</label>
          <input 
            type="text" 
            id="username" 
            v-model="username" 
            placeholder="请输入用户名"
            required
            :class="{'error-input': errors.username}"
            @blur="validateUsername"
          />
          <span v-if="errors.username" class="error-text">{{ errors.username }}</span>
        </div>
        
        <div class="form-group">
          <label for="email">邮箱</label>
          <input 
            type="email" 
            id="email" 
            v-model="email" 
            placeholder="请输入邮箱地址" 
            required 
            :class="{'error-input': errors.email}"
            @blur="validateEmail"
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
              placeholder="请输入密码（至少6个字符）" 
              required 
              :class="{'error-input': errors.password}"
              @blur="validatePassword"
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
        
        <div class="form-group">
          <label for="confirmPassword">确认密码</label>
          <div class="password-input-container">
            <input 
              :type="showConfirmPassword ? 'text' : 'password'" 
              id="confirmPassword" 
              v-model="confirmPassword" 
              placeholder="请再次输入密码" 
              required 
              :class="{'error-input': errors.confirmPassword}"
              @blur="validateConfirmPassword"
            />
            <button 
              type="button" 
              class="toggle-password" 
              @click="showConfirmPassword = !showConfirmPassword"
            >
              {{ showConfirmPassword ? '隐藏' : '显示' }}
            </button>
          </div>
          <span v-if="errors.confirmPassword" class="error-text">{{ errors.confirmPassword }}</span>
        </div>
        
        <div class="form-group checkbox-group">
          <label class="checkbox-container">
            <input type="checkbox" v-model="agreeTerms" />
            <span>我同意 <a href="#" @click.prevent="showTerms">使用条款</a> 和 <a href="#" @click.prevent="showPrivacy">隐私政策</a></span>
          </label>
          <span v-if="errors.agreeTerms" class="error-text">{{ errors.agreeTerms }}</span>
        </div>
        
        <button type="submit" class="register-button" :disabled="isLoading">
          {{ isLoading ? '注册中...' : '创建账号' }}
        </button>
        
        <div v-if="error" class="auth-error">{{ error }}</div>
      </form>
      
      <div class="register-footer">
        <p>已经有账号？ <router-link to="/login">登录</router-link></p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../store/auth';

const router = useRouter();
const authStore = useAuthStore();

// 表单数据
const username = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const agreeTerms = ref(false);
const showPassword = ref(false);
const showConfirmPassword = ref(false);

// 状态
const isLoading = ref(false);
const error = ref('');
const errors = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  agreeTerms: ''
});

// 验证用户名
const validateUsername = () => {
  if (!username.value) {
    errors.username = '用户名不能为空';
    return false;
  } else if (username.value.length < 3) {
    errors.username = '用户名至少需要3个字符';
    return false;
  } else if (username.value.length > 20) {
    errors.username = '用户名不能超过20个字符';
    return false;
  }
  errors.username = '';
  return true;
};

// 验证邮箱
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

// 验证表单
const validateForm = () => {
  const isUsernameValid = validateUsername();
  const isEmailValid = validateEmail();
  const isPasswordValid = validatePassword();
  const isConfirmPasswordValid = validateConfirmPassword();
  const isTermsValid = validateTerms();
  
  return isUsernameValid && isEmailValid && isPasswordValid && isConfirmPasswordValid && isTermsValid;
};

// 密码强度检查
const checkPasswordStrength = (pwd: string): {strength: 'weak' | 'medium' | 'strong', message: string} => {
  const hasLowercase = /[a-z]/.test(pwd);
  const hasUppercase = /[A-Z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
  
  const count = [hasLowercase, hasUppercase, hasNumber, hasSpecial].filter(Boolean).length;
  
  if (count <= 1) {
    return { strength: 'weak', message: '密码强度: 弱（建议包含大小写字母、数字和特殊字符）' };
  } else if (count === 2 || count === 3) {
    return { strength: 'medium', message: '密码强度: 中（可以添加更多类型字符提高安全性）' };
  } else {
    return { strength: 'strong', message: '密码强度: 强' };
  }
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
  
  // 显示密码强度
  const { strength, message } = checkPasswordStrength(password.value);
  if (strength === 'weak') {
    errors.password = message;
    return false;
  } else {
    errors.password = message;
    return true;
  }
};

// 验证确认密码
const validateConfirmPassword = () => {
  if (!confirmPassword.value) {
    errors.confirmPassword = '请确认密码';
    return false;
  } else if (confirmPassword.value !== password.value) {
    errors.confirmPassword = '两次输入的密码不一致';
    return false;
  }
  errors.confirmPassword = '';
  return true;
};

// 验证条款同意
const validateTerms = () => {
  if (!agreeTerms.value) {
    errors.agreeTerms = '您必须同意条款和政策才能注册';
    return false;
  }
  errors.agreeTerms = '';
  return true;
};

// 处理注册
const handleRegister = async () => {
  // 重置错误信息
  error.value = '';
  
  // 验证表单
  if (!validateForm()) {
    return;
  }
  
  // 验证是否同意条款
  if (!agreeTerms.value) {
    errors.agreeTerms = '您必须同意使用条款和隐私政策';
    return;
  }
  
  isLoading.value = true;
  
  try {
    await authStore.register({
      username: username.value, 
      email: email.value, 
      password: password.value,
      confirmPassword: confirmPassword.value
    });
    
    // 存储邮箱，方便后续登录
    localStorage.setItem('rememberedEmail', email.value);
    
    router.push('/login?registered=true');
  } catch (err: any) {
    if (err.response && err.response.data && err.response.data.message) {
      error.value = err.response.data.message;
    } else {
      error.value = '注册失败，该邮箱可能已被使用';
    }
    console.error('注册错误:', err);
  } finally {
    isLoading.value = false;
  }
};

// 显示条款
const showTerms = () => {
  alert('使用条款内容（示例）');
};

// 显示隐私政策
const showPrivacy = () => {
  alert('隐私政策内容（示例）');
};
</script>

<style scoped lang="scss">
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 20px;
}

.register-card {
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 500px;
  padding: 40px;
}

.register-header {
  text-align: center;
  margin-bottom: 30px;
  
  .register-logo {
    width: 60px;
    height: 60px;
    margin-bottom: 16px;
  }
  
  .register-title {
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 8px;
    color: #333;
  }
  
  .register-subtitle {
    font-size: 16px;
    color: #606266;
    margin: 0;
  }
}

.register-form {
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

.checkbox-group {
  margin-bottom: 24px;
  
  .checkbox-container {
    display: flex;
    align-items: flex-start;
    cursor: pointer;
    
    input {
      width: auto;
      margin-right: 8px;
      margin-top: 3px;
    }
    
    span {
      font-size: 14px;
      color: #606266;
      
      a {
        color: #409eff;
        text-decoration: none;
        
        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
}

.register-button {
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

.register-footer {
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

@media (max-width: 576px) {
  .register-card {
    padding: 30px 20px;
  }
}
</style> 
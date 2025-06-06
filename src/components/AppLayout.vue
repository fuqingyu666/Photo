<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="header-container">
        <div class="header-logo" @click="goToHome">
          <img src="/favicon.svg" alt="Logo" class="logo-img" />
          <span>照片管理</span>
        </div>
        
        <nav class="header-nav">
          <router-link to="/" class="nav-item">
            <i class="el-icon-house"></i>个人主页
          </router-link>
          <router-link to="/upload" class="nav-item">
            <i class="el-icon-upload"></i>上传
          </router-link>
          <router-link to="/shared" class="nav-item">
            <i class="el-icon-share"></i>共享
          </router-link>
          <router-link to="/ai-chat" class="nav-item">
            <i class="el-icon-chat-dot-round"></i>AI助手
          </router-link>
        </nav>
        
        <div class="header-user" @click="toggleUserMenu">
          <el-avatar :size="32" :src="user?.avatar || defaultAvatar"></el-avatar>
          <span>{{ user?.name || '用户' }}</span>
          <i class="el-icon-arrow-down"></i>
          
          <div v-if="showUserMenu" class="user-menu">
            <div class="menu-item" @click.stop="viewProfile">
              <i class="el-icon-user"></i>个人资料
            </div>
            <div class="menu-item" @click.stop="viewSettings">
              <i class="el-icon-setting"></i>设置
            </div>
            <div class="menu-divider"></div>
            <div class="menu-item logout" @click.stop="logout">
              <i class="el-icon-switch-button"></i>退出登录
            </div>
          </div>
        </div>
      </div>
    </header>
    
    <main class="app-main">
      <div class="main-container">
        <slot></slot>
      </div>
    </main>
    
    <footer class="app-footer">
      <div class="footer-container">
        <p>&copy; {{ currentYear }} 照片管理应用 | 由 Vue 3 + TypeScript 构建</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../store/auth';

const router = useRouter();
const authStore = useAuthStore();
const user = computed(() => authStore.user);
const defaultAvatar = 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png';
const showUserMenu = ref(false);
const currentYear = new Date().getFullYear();

// 导航到主页
const goToHome = () => {
  router.push('/');
};

// 切换用户菜单显示状态
const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value;
};

// 关闭用户菜单
const closeUserMenu = () => {
  showUserMenu.value = false;
};

// 查看用户资料
const viewProfile = () => {
  // 这里可以打开个人资料页面或模态框
  closeUserMenu();
};

// 查看设置
const viewSettings = () => {
  // 这里可以打开设置页面或模态框
  closeUserMenu();
};

// 退出登录
const logout = () => {
  authStore.logout();
  router.push('/login');
};

// 点击外部关闭用户菜单
document.addEventListener('click', () => {
  showUserMenu.value = false;
});
</script>

<style scoped lang="scss">
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  background-color: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 0 20px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  height: 60px;
  margin: 0 auto;
  width: 100%;
}

.header-logo {
  display: flex;
  align-items: center;
  cursor: pointer;
  
  .logo-img {
    width: 32px;
    height: 32px;
    margin-right: 10px;
  }
  
  span {
    font-size: 20px;
    font-weight: 600;
    color: #333;
  }
}

.header-nav {
  display: flex;
  gap: 24px;
  
  .nav-item {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #606266;
    text-decoration: none;
    font-weight: 500;
    padding: 6px 0;
    position: relative;
    
    &:hover, &.router-link-active {
      color: #409EFF;
    }
    
    &.router-link-active::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 2px;
      background-color: #409EFF;
    }
  }
}

.header-user {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  position: relative;
  padding: 6px 10px;
  border-radius: 4px;
  
  &:hover {
    background-color: #f5f7fa;
  }
  
  span {
    font-weight: 500;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.user-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  width: 160px;
  z-index: 101;
  overflow: hidden;
  margin-top: 8px;
  
  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    color: #606266;
    
    &:hover {
      background-color: #f5f7fa;
    }
    
    &.logout {
      color: #f56c6c;
    }
  }
  
  .menu-divider {
    height: 1px;
    background-color: #ebeef5;
    margin: 4px 0;
  }
}

.app-main {
  flex: 1;
  background-color: #f5f7fa;
  padding: 20px;
}

.main-container {
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.app-footer {
  background-color: #ffffff;
  padding: 16px 20px;
  border-top: 1px solid #ebeef5;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  text-align: center;
  
  p {
    margin: 0;
    color: #909399;
    font-size: 14px;
  }
}

@media (max-width: 768px) {
  .header-logo {
    span {
      display: none;
    }
  }
  
  .header-nav {
    gap: 16px;
  }
  
  .header-user {
    span {
      display: none;
    }
  }
}

@media (max-width: 576px) {
  .app-header {
    padding: 0 10px;
  }
  
  .header-nav {
    gap: 8px;
    
    .nav-item {
      font-size: 12px;
    }
  }
  
  .app-main {
    padding: 10px;
  }
}
</style> 
<template>
  <div class="not-found-page">
    <div class="not-found-content">
      <h1>404</h1>
      <h2>Page Not Found</h2>
      <p>The page you are looking for does not exist or has been moved.</p>
      <el-button type="primary" @click="$router.push('/')">Back to Home</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
// Not Found page
</script>

<style lang="scss" scoped>
.not-found-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f7fa;
}

.not-found-content {
  text-align: center;
  padding: 40px;
  
  h1 {
    font-size: 120px;
    margin: 0;
    color: #409EFF;
    line-height: 1;
  }
  
  h2 {
    font-size: 32px;
    margin: 0 0 16px;
    color: #303133;
  }
  
  p {
    font-size: 18px;
    margin-bottom: 32px;
    color: #606266;
  }
}
</style> 
<script setup lang="ts">
// 展示组件只接收布局层提供的状态，不反向依赖认证业务模块。
defineProps<{
  authenticated: boolean
  username?: string
  restoring: boolean
  loggingOut: boolean
  hasSession: boolean
  error: string | null
}>()
defineEmits<{ logout: []; retry: [] }>()
</script>

<template>
  <header class="topbar">
    <RouterLink class="brand" to="/" aria-label="返回首页">
      <span class="brand-mark" aria-hidden="true">杏</span>
      <span>
        <strong>Ginkgo 美食地图</strong>
        <small>Ginkgo 烹饪社</small>
      </span>
    </RouterLink>

    <nav aria-label="主要导航">
      <RouterLink to="/">地图首页</RouterLink>
      <button type="button" disabled>排行榜</button>
      <template v-if="authenticated">
        <span class="account-name" :title="username">{{ username }}</span>
        <button class="login-button" type="button" :disabled="loggingOut" @click="$emit('logout')">
          {{ loggingOut ? '正在退出…' : '退出' }}
        </button>
      </template>
      <span v-else-if="restoring" role="status">正在恢复登录…</span>
      <template v-else>
        <RouterLink class="register-link" to="/register">注册</RouterLink>
        <RouterLink class="login-button" to="/login">登录</RouterLink>
      </template>
    </nav>
  </header>
  <div v-if="error" class="auth-feedback" role="alert">
    {{ error }}
    <button v-if="hasSession && !authenticated" type="button" @click="$emit('retry')">重试</button>
  </div>
</template>

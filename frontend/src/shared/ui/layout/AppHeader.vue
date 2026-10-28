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
      <!-- 原版页头杯型的精确路径；共享布局不依赖业务模块。 -->
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="19" height="19" focusable="false">
          <path
            d="M6.2 8.4h11.6l-1.35 10.2H7.55Z"
            fill="#E9B949"
            stroke="#2B2A26"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
          <path
            d="M17.1 10.4h1.35a2.15 2.15 0 0 1 0 4.3h-1.1"
            fill="none"
            stroke="#2B2A26"
            stroke-width="1.4"
            stroke-linecap="round"
          />
          <path d="M4.9 5.6h14.2" stroke="#2B2A26" stroke-width="1.7" stroke-linecap="round" />
        </svg>
      </span>
      <span>
        <strong>Ginkgo 美食地图</strong>
        <small>Ginkgo 烹饪社</small>
      </span>
    </RouterLink>

    <nav aria-label="主要导航">
      <RouterLink to="/">发现美食</RouterLink>
      <RouterLink to="/scoring-guide">评分说明</RouterLink>
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

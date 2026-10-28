<script setup lang="ts">
import { LoginForm } from '@/modules/auth'
</script>

<template>
  <div class="login-page">
    <section class="login-intro" aria-labelledby="login-intro-title">
      <p class="eyebrow">GINKGO FOOD MAP</p>
      <h2 id="login-intro-title">下一顿，<br />一起发现。</h2>
      <p>登录你的账号，继续记录校园里的美食记忆。</p>
      <p class="session-hint">
        登录后会自动保留登录状态，关闭页面后再次访问也可恢复。使用公共电脑时，请在离开前退出账号。
      </p>
    </section>
    <LoginForm />
  </div>
</template>

<style scoped>
.login-page {
  width: min(1000px, calc(100% - 40px));
  margin: 0 auto;
  padding: 80px 0 100px;
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  gap: clamp(40px, 7vw, 90px);
  align-items: center;
}
h2 {
  margin: 14px 0 22px;
  font-family: Georgia, 'Songti SC', serif;
  font-size: clamp(44px, 6vw, 72px);
  line-height: 1.12;
  letter-spacing: -0.05em;
}
.login-intro > p:not(.eyebrow) {
  color: #625c52;
  line-height: 1.9;
}
.session-hint {
  margin-top: 30px;
  padding: 18px 22px;
  border-radius: 20px;
  background: #f0eadf;
  font-size: 14px;
}
@media (max-width: 760px) {
  .login-page {
    width: calc(100% - 28px);
    grid-template-columns: 1fr;
    padding-top: 36px;
  }
}
</style>

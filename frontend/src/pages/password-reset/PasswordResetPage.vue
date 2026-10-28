<script setup lang="ts">
import { PasswordResetForm } from '@/modules/auth'
</script>

<template>
  <div class="password-reset-page">
    <section class="reset-intro" aria-labelledby="reset-intro-title">
      <p class="eyebrow">GINKGO FOOD MAP</p>
      <h2 id="reset-intro-title">找回账号，<br />继续探索。</h2>
      <p>使用注册时绑定的学生邮箱收取验证码，即可设置新密码。</p>
      <p>重置成功后，请在各个设备上使用新密码重新登录。</p>
    </section>
    <PasswordResetForm />
  </div>
</template>

<style scoped>
.password-reset-page {
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
.reset-intro > p:not(.eyebrow) {
  color: #625c52;
  line-height: 1.9;
}
@media (max-width: 760px) {
  .password-reset-page {
    width: calc(100% - 28px);
    grid-template-columns: 1fr;
    padding-top: 36px;
  }
}
</style>

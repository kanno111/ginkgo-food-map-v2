<script setup lang="ts">
import { RegistrationForm } from '@/modules/auth'
</script>

<template>
  <div class="register-page">
    <section class="register-intro" aria-labelledby="register-intro-title">
      <p class="eyebrow">UESTC STUDENTS ONLY</p>
      <h2 id="register-intro-title">从一封校园邮件开始。</h2>
      <p>
        我们只接受电子科技大学学生邮箱注册。邮箱验证帮助社区减少广告账号，让每一条评价更值得参考。
      </p>

      <div class="register-promise">
        <span aria-hidden="true">杏</span>
        <div>
          <strong>你的密码不会被明文保存</strong>
          <small>验证码仅可使用一次，注册成功后也不会自动登录。</small>
        </div>
      </div>
    </section>

    <RegistrationForm />
  </div>
</template>

<style scoped>
.register-page {
  width: min(1080px, calc(100% - 40px));
  margin: 0 auto;
  padding: 66px 0 96px;
  display: grid;
  grid-template-columns: minmax(0, 0.82fr) minmax(520px, 1.18fr);
  gap: clamp(42px, 7vw, 86px);
  align-items: center;
}

.register-intro h2 {
  max-width: 470px;
  margin: 14px 0 22px;
  font-family: Georgia, 'Songti SC', serif;
  font-size: clamp(44px, 6vw, 72px);
  line-height: 1.08;
  letter-spacing: -0.05em;
}

.register-intro > p:not(.eyebrow) {
  color: #625c52;
  font-size: 17px;
  line-height: 1.9;
}

.register-promise {
  margin-top: 34px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  border-radius: 20px;
  background: #f0eadf;
}

.register-promise > span {
  width: 48px;
  height: 48px;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 15px;
  color: #fff;
  background: #2b2a26;
  font-family: serif;
}

.register-promise strong,
.register-promise small {
  display: block;
}

.register-promise small {
  margin-top: 5px;
  color: #776f62;
  line-height: 1.5;
}

@media (max-width: 900px) {
  .register-page {
    grid-template-columns: 1fr;
    padding-top: 42px;
  }

  .register-intro {
    max-width: 680px;
  }
}

@media (max-width: 620px) {
  .register-page {
    width: min(100% - 28px, 1080px);
  }
}
</style>

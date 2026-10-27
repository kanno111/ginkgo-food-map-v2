<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'

import { useRegistrationStore } from '../model/registration.store'

const CAMPUS_EMAIL_PATTERN = /^[^\s@]+@std\.uestc\.edu\.cn$/i
const USERNAME_PATTERN = /^[\p{L}\p{N}_]+$/u
const CODE_PATTERN = /^[0-9]{6}$/
const RESEND_SECONDS = 60

const registrationStore = useRegistrationStore()
// Pinia 会跨路由保留状态，进入页面时主动清理上一次注册结果，但不持久化任何表单字段。
registrationStore.reset()
const form = reactive({
  email: '',
  verificationCode: '',
  username: '',
  password: '',
  confirmPassword: '',
})
const localError = ref<string | null>(null)
const cooldown = ref(0)
let cooldownTimer: ReturnType<typeof globalThis.setInterval> | undefined

const feedback = computed(() => localError.value ?? registrationStore.error)
const codeButtonText = computed(() => {
  if (registrationStore.sendingCode) return '正在发送…'
  return cooldown.value > 0 ? `${cooldown.value} 秒后重试` : '发送验证码'
})

/** 前端先给出即时提示，服务端仍会重新执行全部安全校验。 */
function validateForm(): string | null {
  const email = form.email.trim()
  const username = form.username.trim()
  const usernameLength = Array.from(username).length
  const passwordLength = Array.from(form.password).length
  const passwordBytes = new globalThis.TextEncoder().encode(form.password).length

  if (!CAMPUS_EMAIL_PATTERN.test(email)) return '请使用 @std.uestc.edu.cn 学生邮箱'
  if (!CODE_PATTERN.test(form.verificationCode)) return '请输入邮件中的6位数字验证码'
  if (usernameLength < 3 || usernameLength > 32 || !USERNAME_PATTERN.test(username)) {
    return '用户名应为3至32个文字、数字或下划线'
  }
  if (
    passwordLength < 8 ||
    passwordBytes > 72 ||
    !/\p{L}/u.test(form.password) ||
    !/\p{N}/u.test(form.password)
  ) {
    return '密码至少8位并同时包含文字和数字，且不能超过72字节'
  }
  if (form.password !== form.confirmPassword) return '两次输入的密码不一致'
  return null
}

function startCooldown() {
  cooldown.value = RESEND_SECONDS
  if (cooldownTimer) globalThis.clearInterval(cooldownTimer)
  cooldownTimer = globalThis.setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0 && cooldownTimer) {
      globalThis.clearInterval(cooldownTimer)
      cooldownTimer = undefined
    }
  }, 1_000)
}

async function handleSendCode() {
  localError.value = null
  registrationStore.clearError()
  const normalizedEmail = form.email.trim().toLowerCase()
  if (!CAMPUS_EMAIL_PATTERN.test(normalizedEmail)) {
    localError.value = '请先填写正确的电子科技大学学生邮箱'
    return
  }

  if (await registrationStore.sendCode(normalizedEmail)) {
    startCooldown()
  }
}

async function handleSubmit() {
  localError.value = validateForm()
  registrationStore.clearError()
  if (localError.value) return

  const success = await registrationStore.submit({
    email: form.email.trim().toLowerCase(),
    verificationCode: form.verificationCode,
    username: form.username.trim(),
    password: form.password,
  })
  if (success) {
    // 请求完成后立即清除页面中的敏感字段；账号信息保留用于确认用户刚刚注册的身份。
    form.verificationCode = ''
    form.password = ''
    form.confirmPassword = ''
  }
}

/** 用户继续编辑时清除上一次提示，避免旧错误看起来仍对应当前输入。 */
function clearFeedback() {
  localError.value = null
  registrationStore.clearError()
}

onBeforeUnmount(() => {
  if (cooldownTimer) globalThis.clearInterval(cooldownTimer)
})
</script>

<template>
  <form class="registration-form" novalidate @input="clearFeedback" @submit.prevent="handleSubmit">
    <div class="form-heading">
      <p class="eyebrow">CREATE ACCOUNT</p>
      <h1>加入 Ginkgo</h1>
      <p>使用电子科技大学学生邮箱，记录属于你的校园味道。</p>
    </div>

    <div class="form-field">
      <label for="register-email">学生邮箱</label>
      <div class="field-with-action">
        <input
          id="register-email"
          v-model="form.email"
          type="email"
          autocomplete="email"
          placeholder="学号@std.uestc.edu.cn"
          :disabled="registrationStore.registered"
        />
        <button
          class="code-button"
          type="button"
          :disabled="registrationStore.sendingCode || cooldown > 0 || registrationStore.registered"
          @click="handleSendCode"
        >
          {{ codeButtonText }}
        </button>
      </div>
      <small>验证码5分钟内有效，同一邮箱60秒内只能发送一次。</small>
    </div>

    <div class="form-field">
      <label for="register-code">邮箱验证码</label>
      <input
        id="register-code"
        v-model="form.verificationCode"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="6"
        placeholder="6位数字验证码"
        :disabled="registrationStore.registered"
      />
    </div>

    <div class="form-field">
      <label for="register-username">用户名</label>
      <input
        id="register-username"
        v-model="form.username"
        type="text"
        autocomplete="username"
        maxlength="32"
        placeholder="3至32个文字、数字或下划线"
        :disabled="registrationStore.registered"
      />
    </div>

    <div class="password-grid">
      <div class="form-field">
        <label for="register-password">密码</label>
        <input
          id="register-password"
          v-model="form.password"
          type="password"
          autocomplete="new-password"
          placeholder="至少8位，包含文字和数字"
          :disabled="registrationStore.registered"
        />
      </div>
      <div class="form-field">
        <label for="register-confirm-password">确认密码</label>
        <input
          id="register-confirm-password"
          v-model="form.confirmPassword"
          type="password"
          autocomplete="new-password"
          placeholder="再次输入密码"
          :disabled="registrationStore.registered"
        />
      </div>
    </div>

    <p v-if="feedback" class="form-message error-message" role="alert">{{ feedback }}</p>
    <div v-if="registrationStore.registered" class="form-message success-message" role="status">
      <strong>账号创建成功</strong>
      <span>现在可以使用新账号<RouterLink to="/login">前往登录</RouterLink>。</span>
    </div>

    <button
      class="submit-button"
      type="submit"
      :disabled="registrationStore.registering || registrationStore.registered"
    >
      {{ registrationStore.registering ? '正在创建账号…' : '创建账号' }}
    </button>

    <p class="form-footnote">注册即表示你会友善、真实地分享校园美食体验。</p>
  </form>
</template>

<style scoped>
.registration-form {
  padding: clamp(28px, 5vw, 46px);
  border: 1px solid #ded7c9;
  border-radius: 34px;
  background: #fffdf8;
  box-shadow: 0 24px 70px rgb(76 54 8 / 10%);
}

.form-heading {
  margin-bottom: 30px;
}

.form-heading h1 {
  margin: 8px 0 12px;
  font-family: Georgia, 'Songti SC', serif;
  font-size: clamp(36px, 5vw, 52px);
}

.form-heading p:last-child {
  margin: 0;
  color: #6b6357;
  line-height: 1.7;
}

.form-field {
  margin-top: 20px;
}

.form-field label {
  display: block;
  margin-bottom: 9px;
  font-size: 14px;
  font-weight: 800;
}

.form-field input {
  width: 100%;
  height: 50px;
  padding: 0 15px;
  border: 1px solid #d8d0c2;
  border-radius: 14px;
  outline: none;
  color: #2b2a26;
  background: #fff;
  font: inherit;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.form-field input:focus {
  border-color: #b67c00;
  box-shadow: 0 0 0 4px rgb(233 185 73 / 20%);
}

.form-field input:disabled {
  color: #80786d;
  background: #f3eee5;
}

.form-field small {
  display: block;
  margin-top: 8px;
  color: #80786d;
  font-size: 12px;
  line-height: 1.5;
}

.field-with-action {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.code-button {
  min-width: 124px;
  padding: 0 16px;
  border: 0;
  border-radius: 14px;
  color: #2b2a26;
  background: #e9b949;
  font-weight: 800;
  cursor: pointer;
}

.password-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.form-message {
  margin: 20px 0 0;
  padding: 14px 16px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.6;
}

.error-message {
  color: #8b2f29;
  background: #fbe7e3;
}

.success-message {
  display: flex;
  flex-direction: column;
  color: #225f3e;
  background: #dcefe3;
}

.submit-button {
  width: 100%;
  min-height: 52px;
  margin-top: 24px;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: #2b2a26;
  font-weight: 800;
  cursor: pointer;
}

.form-footnote {
  margin: 16px 0 0;
  color: #80786d;
  font-size: 12px;
  text-align: center;
}

@media (max-width: 620px) {
  .field-with-action,
  .password-grid {
    grid-template-columns: 1fr;
  }

  .code-button {
    min-height: 46px;
  }
}
</style>

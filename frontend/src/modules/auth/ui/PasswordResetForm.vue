<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { clearAccessToken, getAccessToken } from '@/shared/api/authSession'
import { toErrorMessage } from '@/shared/lib/toErrorMessage'
import { resetPassword, sendPasswordResetCode } from '../api/authApi'

const CAMPUS_EMAIL_PATTERN = /^[^\s@]+@std\.uestc\.edu\.cn$/i
const form = reactive({ email: '', verificationCode: '', newPassword: '', confirmPassword: '' })
const sendingCode = ref(false)
const submitting = ref(false)
const completed = ref(false)
const codeAccepted = ref(false)
const error = ref<string | null>(null)
const cooldown = ref(0)
const busy = computed(() => sendingCode.value || submitting.value)
let active = true
let cooldownTimer: ReturnType<typeof globalThis.setInterval> | undefined

/** 使用截止时间计算剩余秒数，后台标签页定时器暂停不会人为延长本地倒计时。 */
function startCooldown() {
  const deadline = Date.now() + 60_000
  cooldown.value = 60
  cooldownTimer = globalThis.setInterval(() => {
    cooldown.value = Math.max(0, Math.ceil((deadline - Date.now()) / 1_000))
    if (cooldown.value === 0) globalThis.clearInterval(cooldownTimer)
  }, 1_000)
}

/** 仅提示受理结果，不以文案或页面状态透露邮箱是否已注册。服务端仍执行最终限流。 */
async function handleSendCode() {
  if (busy.value || completed.value || cooldown.value > 0) return
  error.value = null
  codeAccepted.value = false
  const email = form.email.trim().toLowerCase()
  if (!CAMPUS_EMAIL_PATTERN.test(email)) {
    error.value = '请先填写正确的电子科技大学学生邮箱'
    return
  }
  sendingCode.value = true
  try {
    await sendPasswordResetCode(email)
    if (active) {
      codeAccepted.value = true
      startCooldown()
    }
  } catch (reason) {
    if (active) error.value = toErrorMessage(reason)
  } finally {
    sendingCode.value = false
  }
}

/** 校验只用于即时反馈，后端会再次验证校园邮箱、专用验证码、密码强度和账号状态。 */
function validateForm(): string | null {
  if (!CAMPUS_EMAIL_PATTERN.test(form.email.trim())) return '请使用 @std.uestc.edu.cn 学生邮箱'
  if (!/^[0-9]{6}$/.test(form.verificationCode)) return '请输入邮件中的6位数字验证码'
  const password = form.newPassword
  if (
    Array.from(password).length < 8 ||
    new globalThis.TextEncoder().encode(password).length > 72 ||
    !/\p{L}/u.test(password) ||
    !/\p{Nd}/u.test(password) ||
    /\p{Cc}/u.test(password)
  ) {
    return '新密码至少8位，包含文字和数字，不含控制字符，且不能超过72字节'
  }
  if (password !== form.confirmPassword) return '两次输入的新密码不一致'
  return null
}

/** 密码仅留在表单内；重置成功清理请求开始时的旧凭证，不能误删期间产生的新登录。 */
async function handleSubmit() {
  if (busy.value || completed.value) return
  error.value = validateForm()
  if (error.value) return
  submitting.value = true
  const previousToken = getAccessToken()
  try {
    await resetPassword({
      email: form.email.trim().toLowerCase(),
      verificationCode: form.verificationCode,
      newPassword: form.newPassword,
    })
    if (previousToken) clearAccessToken(previousToken)
    form.verificationCode = ''
    if (active) completed.value = true
  } catch (reason) {
    if (active) error.value = toErrorMessage(reason)
  } finally {
    // 请求成功与失败均释放明文密码，避免敏感输入随错误页面长期驻留。
    form.newPassword = ''
    form.confirmPassword = ''
    submitting.value = false
  }
}

onBeforeUnmount(() => {
  active = false
  globalThis.clearInterval(cooldownTimer)
  form.verificationCode = ''
  form.newPassword = ''
  form.confirmPassword = ''
})
</script>

<template>
  <form
    class="password-reset-form"
    aria-labelledby="password-reset-title"
    novalidate
    @input="error = null"
    @submit.prevent="handleSubmit"
  >
    <p class="eyebrow">RESET PASSWORD</p>
    <h1 id="password-reset-title">找回密码</h1>
    <p class="form-intro">通过账号绑定的学生邮箱验证身份，设置新的登录密码。</p>

    <fieldset :disabled="busy || completed">
      <legend class="sr-only">邮箱验证与新密码</legend>
      <div class="form-field">
        <label for="reset-email">学生邮箱</label>
        <div class="field-with-action">
          <input
            id="reset-email"
            v-model="form.email"
            name="email"
            type="email"
            autocomplete="email"
            placeholder="学号@std.uestc.edu.cn"
            @input="codeAccepted = false"
          />
          <button
            class="code-button"
            type="button"
            :disabled="cooldown > 0"
            @click="handleSendCode"
          >
            {{ sendingCode ? '正在发送…' : cooldown > 0 ? `${cooldown} 秒后重试` : '发送验证码' }}
          </button>
        </div>
        <small>验证码5分钟内有效，与注册验证码不能混用。</small>
      </div>
      <div class="form-field">
        <label for="reset-code">邮箱验证码</label>
        <input
          id="reset-code"
          v-model="form.verificationCode"
          name="verificationCode"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          placeholder="6位数字验证码"
        />
      </div>
      <div class="form-field">
        <label for="reset-password">新密码</label>
        <input
          id="reset-password"
          v-model="form.newPassword"
          name="newPassword"
          type="password"
          autocomplete="new-password"
          placeholder="至少8位，包含文字和数字"
        />
      </div>
      <div class="form-field">
        <label for="reset-confirm-password">确认新密码</label>
        <input
          id="reset-confirm-password"
          v-model="form.confirmPassword"
          name="confirmPassword"
          type="password"
          autocomplete="new-password"
          placeholder="再次输入新密码"
        />
      </div>
      <button class="primary-action submit-button" type="submit">
        {{ submitting ? '正在重置…' : '设置新密码' }}
      </button>
    </fieldset>

    <p v-if="codeAccepted && !completed" class="form-message" role="status">
      请求已受理。如该邮箱已注册，验证码将发送至该邮箱，请查看收件箱。
    </p>
    <p v-if="error" class="form-message error-message" role="alert">{{ error }}</p>
    <div v-if="completed" class="form-message success-message" role="status">
      <strong>密码重置成功</strong>
      <p>所有设备已退出登录，请使用用户名和新密码重新登录。</p>
      <RouterLink to="/login">前往登录</RouterLink>
    </div>
    <p class="form-footnote"><RouterLink to="/login">返回登录</RouterLink></p>
  </form>
</template>

<style scoped>
.password-reset-form {
  padding: clamp(28px, 5vw, 46px);
  border: 1px solid #ded7c9;
  border-radius: 34px;
  background: #fffdf8;
  box-shadow: 0 24px 70px rgb(76 54 8 / 10%);
}
h1 {
  margin: 8px 0 12px;
  font-family: Georgia, 'Songti SC', serif;
  font-size: clamp(36px, 5vw, 52px);
}
.form-intro,
.form-footnote,
small {
  color: #6b6357;
  line-height: 1.7;
}
fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.form-field {
  margin-top: 20px;
}
label {
  display: block;
  margin-bottom: 9px;
  font-size: 14px;
  font-weight: 800;
}
input {
  width: 100%;
  min-width: 0;
  height: 50px;
  padding: 0 15px;
  border: 1px solid #d8d0c2;
  border-radius: 14px;
  color: #2b2a26;
  background: #fff;
  font: inherit;
}
input:focus {
  outline: 2px solid #b67c00;
  outline-offset: 2px;
}
small {
  display: block;
  margin-top: 8px;
  font-size: 12px;
}
.field-with-action {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}
.code-button {
  padding: 0 16px;
  border: 0;
  border-radius: 14px;
  color: #2b2a26;
  background: #e9b949;
  font-weight: 800;
}
button {
  cursor: pointer;
}
.submit-button {
  width: 100%;
  margin-top: 28px;
}
.form-message {
  margin-top: 20px;
  padding: 14px 16px;
  border-radius: 14px;
  background: #f0eadf;
  line-height: 1.6;
}
.error-message {
  color: #8b2f29;
  background: #fbe7e3;
}
.success-message {
  color: #225f3e;
  background: #dcefe3;
}
.form-footnote {
  text-align: center;
}
@media (max-width: 480px) {
  .field-with-action {
    grid-template-columns: 1fr;
  }
  .code-button {
    min-height: 44px;
  }
}
</style>

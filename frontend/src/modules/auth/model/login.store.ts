import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  authToken,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from '@/shared/api/authSession'
import { toErrorMessage } from '@/shared/lib/toErrorMessage'
import { fetchCurrentUser, login, logout } from '../api/authApi'
import type { CurrentUser, LoginRequest } from './login.types'

/** 管理登录展示状态；密码不进入 Store，旧请求也不能恢复已经退出的账号。 */
export const useLoginStore = defineStore('login', () => {
  const user = ref<CurrentUser | null>(null)
  const loggingIn = ref(false)
  const restoring = ref(false)
  const loggingOut = ref(false)
  const error = ref<string | null>(null)
  const authenticated = computed(() => user.value !== null && authToken.value !== null)
  const hasSession = computed(() => authToken.value !== null)
  let revision = 0

  // 401 清理凭证时同步清除导航账号，并使尚未完成的请求结果失效。
  watch(
    authToken,
    (value) => {
      if (value === null) {
        user.value = null
        revision++
      }
    },
    { flush: 'sync' },
  )

  /** 提交后仅保存令牌和公开用户信息，不保留请求中的密码。 */
  async function submit(request: LoginRequest): Promise<boolean> {
    if (loggingIn.value) return false
    const current = ++revision
    loggingIn.value = true
    error.value = null
    try {
      const result = await login(request)
      if (current !== revision) return false
      setAccessToken(result.accessToken)
      user.value = result.user
      return true
    } catch (reason) {
      if (current === revision) error.value = toErrorMessage(reason)
      return false
    } finally {
      loggingIn.value = false
    }
  }

  /** 刷新后由服务端重新验证身份；网络故障保留凭证以供重试，401由HTTP层清理。 */
  async function restore(): Promise<void> {
    const token = getAccessToken()
    if (!token || restoring.value) return
    const current = ++revision
    restoring.value = true
    error.value = null
    try {
      const result = await fetchCurrentUser(token)
      if (current === revision && getAccessToken() === token) user.value = result
    } catch (reason) {
      if (getAccessToken() === token) error.value = toErrorMessage(reason)
    } finally {
      restoring.value = false
    }
  }

  /** 撤销当前会话，失败时保留可重试状态；异步旧退出不得清除新登录。 */
  async function signOut(): Promise<void> {
    const token = getAccessToken()
    if (!token || loggingOut.value) return
    const current = ++revision
    loggingOut.value = true
    error.value = null
    try {
      await logout(token)
      if (current === revision) clearAccessToken(token)
    } catch (reason) {
      if (getAccessToken() === token) error.value = toErrorMessage(reason)
    } finally {
      loggingOut.value = false
    }
  }

  function clearError(): void {
    error.value = null
  }

  return {
    user,
    loggingIn,
    restoring,
    loggingOut,
    error,
    authenticated,
    hasSession,
    submit,
    restore,
    signOut,
    clearError,
  }
})

import axios from 'axios'
import { clearAccessToken, getAccessToken } from './authSession'

export const httpClient = axios.create({
  timeout: 10_000,
  headers: {
    Accept: 'application/json',
  },
})

// 公开接口不附带旧凭证，防止已过期的 Bearer 令牌阻止用户重新登录或注册。
const publicAuthPaths = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/email/code/register',
  '/auth/email/code/password-reset',
])

httpClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token && !publicAuthPaths.has(config.url ?? '') && !config.url?.startsWith('/api/public/')) {
    config.headers.Authorization ??= `Bearer ${token}`
  }
  return config
})

httpClient.interceptors.response.use(undefined, (reason: unknown) => {
  if (axios.isAxiosError(reason) && reason.response?.status === 401) {
    const authorization = reason.config?.headers?.Authorization
    if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
      clearAccessToken(authorization.slice(7))
    }
  }
  return Promise.reject(reason)
})

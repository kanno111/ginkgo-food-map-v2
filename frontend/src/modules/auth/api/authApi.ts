import type { ApiResponse } from '@/shared/api/api.types'
import { httpClient } from '@/shared/api/httpClient'

import type { RegistrationRequest } from '../model/registration.types'
import type { CurrentUser, LoginRequest, LoginResponse } from '../model/login.types'
import type { PasswordResetRequest } from '../model/passwordReset.types'

/** 未注册邮箱也返回相同受理结果，页面不得据此推断账号是否存在。 */
export async function sendPasswordResetCode(email: string): Promise<void> {
  await httpClient.post<ApiResponse<null>>('/auth/email/code/password-reset', { email })
}

/** 使用专用验证码设置新密码；成功后所有旧凭证失效，仍须单独登录。 */
export async function resetPassword(request: PasswordResetRequest): Promise<void> {
  await httpClient.post<ApiResponse<null>>('/auth/password-reset', request)
}

/** 请求发送注册验证码；是否允许发送及频率限制最终由服务端决定。 */
export async function sendRegistrationCode(email: string): Promise<void> {
  await httpClient.post<ApiResponse<null>>('/auth/email/code/register', { email })
}

/** 提交注册信息。成功响应不包含 Token，注册后仍需单独登录。 */
export async function register(request: RegistrationRequest): Promise<void> {
  await httpClient.post<ApiResponse<null>>('/auth/register', request)
}

/** 登录成功才返回访问凭证，失败提示沿用统一 API 错误格式。 */
export async function login(request: LoginRequest): Promise<LoginResponse> {
  const response = await httpClient.post<ApiResponse<LoginResponse>>('/auth/login', request)
  return response.data.data
}

/** 显式绑定请求发起时的令牌，避免异步恢复状态时串用新会话。 */
export async function fetchCurrentUser(token: string): Promise<CurrentUser> {
  const response = await httpClient.get<ApiResponse<CurrentUser>>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data.data
}

/** 服务端确认撤销后才能视为退出成功。 */
export async function logout(token: string): Promise<void> {
  await httpClient.post('/auth/logout', null, { headers: { Authorization: `Bearer ${token}` } })
}

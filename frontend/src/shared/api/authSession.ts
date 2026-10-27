import { readonly, shallowRef } from 'vue'

const storageKey = 'ginkgo.access-token'

/** 只在当前标签页保存登录凭证，刷新可恢复；浏览器禁用存储时退化为内存。 */
function readToken(): string | null {
  try {
    return sessionStorage.getItem(storageKey)
  } catch {
    return null
  }
}

const token = shallowRef<string | null>(readToken())
export const authToken = readonly(token)

/** HTTP 层读取凭证，密码始终由表单局部状态管理。 */
export function getAccessToken(): string | null {
  return token.value
}

/** 凭证只写 sessionStorage，不写持久化 localStorage 或 Cookie。 */
export function setAccessToken(value: string): void {
  token.value = value
  try {
    sessionStorage.setItem(storageKey, value)
  } catch {
    // 存储不可用不影响本次内存会话。
  }
}

/** 只清除产生失败请求的凭证，防止旧请求的401覆盖刚完成的新登录。 */
export function clearAccessToken(expectedToken?: string): void {
  if (expectedToken !== undefined && token.value !== expectedToken) return
  token.value = null
  try {
    sessionStorage.removeItem(storageKey)
  } catch {
    // 内存状态已经清除，禁用浏览器存储时无需额外操作。
  }
}

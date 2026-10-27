import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAccessToken, getAccessToken, setAccessToken } from '@/shared/api/authSession'
import { fetchCurrentUser, login, logout } from '../api/authApi'
import { useLoginStore } from './login.store'
import type { CurrentUser, LoginResponse } from './login.types'

vi.mock('../api/authApi', () => ({ login: vi.fn(), fetchCurrentUser: vi.fn(), logout: vi.fn() }))

const user: CurrentUser = { id: 42, username: 'ginkgo_user', roles: ['ROLE_USER'] }
const result: LoginResponse = {
  accessToken: 'test-session',
  tokenType: 'Bearer',
  expiresAt: '2099-01-01T00:00:00Z',
  user,
}
const request = { username: 'ginkgo_user', password: 'Ginkgo2026' }

describe('login store', () => {
  beforeEach(() => {
    clearAccessToken()
    sessionStorage.clear()
    localStorage.clear()
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('keeps the session in this tab without retaining the password', async () => {
    vi.mocked(login).mockResolvedValue(result)
    const store = useLoginStore()
    expect(await store.submit(request)).toBe(true)
    expect(store.authenticated).toBe(true)
    expect(store.user).toEqual(user)
    expect(getAccessToken()).toBe('test-session')
    expect(sessionStorage.getItem('ginkgo.access-token')).toBe('test-session')
    expect(localStorage.length).toBe(0)
    expect(JSON.stringify(store.$state)).not.toContain(request.password)
  })

  it('shows login errors without creating a local session', async () => {
    vi.mocked(login).mockRejectedValue(new Error('用户名或密码错误'))
    const store = useLoginStore()
    expect(await store.submit(request)).toBe(false)
    expect(store.error).toBe('用户名或密码错误')
    expect(store.loggingIn).toBe(false)
    expect(store.authenticated).toBe(false)
    expect(getAccessToken()).toBeNull()
  })

  it('verifies a stored session with the server before marking it authenticated', async () => {
    setAccessToken('test-session')
    vi.mocked(fetchCurrentUser).mockResolvedValue(user)
    const store = useLoginStore()
    expect(store.authenticated).toBe(false)
    await store.restore()
    expect(fetchCurrentUser).toHaveBeenCalledWith('test-session')
    expect(store.authenticated).toBe(true)
  })

  it('preserves a session on temporary restoration failure for retry', async () => {
    setAccessToken('test-session')
    vi.mocked(fetchCurrentUser).mockRejectedValue(new Error('网络暂不可用'))
    const store = useLoginStore()
    await store.restore()
    expect(getAccessToken()).toBe('test-session')
    expect(store.authenticated).toBe(false)
    expect(store.error).toBe('网络暂不可用')
  })

  it('clears the session only after the server confirms logout', async () => {
    vi.mocked(login).mockResolvedValue(result)
    vi.mocked(logout).mockRejectedValueOnce(new Error('退出失败'))
    const store = useLoginStore()
    await store.submit(request)
    await store.signOut()
    expect(store.authenticated).toBe(true)
    expect(store.error).toBe('退出失败')
    vi.mocked(logout).mockResolvedValue()
    await store.signOut()
    expect(getAccessToken()).toBeNull()
    expect(store.user).toBeNull()
    expect(store.authenticated).toBe(false)
  })

  it('cannot resurrect a logged-out user from a late restoration response', async () => {
    setAccessToken('test-session')
    let resolveRestore!: (value: CurrentUser) => void
    vi.mocked(fetchCurrentUser).mockReturnValue(
      new Promise((resolve) => {
        resolveRestore = resolve
      }),
    )
    vi.mocked(logout).mockResolvedValue()
    const store = useLoginStore()
    const restoring = store.restore()
    await store.signOut()
    resolveRestore(user)
    await restoring
    expect(store.user).toBeNull()
    expect(getAccessToken()).toBeNull()
  })

  it('does not let an old logout clear a newer login', async () => {
    setAccessToken('old-session')
    let resolveLogout!: () => void
    vi.mocked(logout).mockReturnValue(
      new Promise((resolve) => {
        resolveLogout = resolve
      }),
    )
    vi.mocked(login).mockResolvedValue(result)
    const store = useLoginStore()
    const signingOut = store.signOut()
    await store.submit(request)
    resolveLogout()
    await signingOut
    expect(getAccessToken()).toBe('test-session')
    expect(store.authenticated).toBe(true)
  })

  it('clears visible identity as soon as a protected request invalidates its token', async () => {
    vi.mocked(login).mockResolvedValue(result)
    const store = useLoginStore()
    await store.submit(request)
    clearAccessToken('test-session')
    expect(store.user).toBeNull()
    expect(store.authenticated).toBe(false)
  })
})

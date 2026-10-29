import { createApp, h, nextTick } from 'vue'
import type { App, Component } from 'vue'
import { createPinia, disposePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAccessToken, clearAccessToken } from '@/shared/api/authSession'
import { useLoginStore } from '@/modules/auth/model/login.store'
import { fetchRestaurants } from '@/modules/restaurant/api/restaurantApi'
import { restaurantFixture } from '@/modules/restaurant/api/restaurant.test-data'
import { overall, validBody, reviewGatewayKey, unavailableReviewGateway } from './model/review'
import type { ReviewGateway, ReviewItem } from './model/review'
import ReviewComposer from './ui/ReviewComposer.vue'
import ReviewPanel from './ui/ReviewPanel.vue'

vi.mock('@/modules/restaurant/api/restaurantApi', () => ({ fetchRestaurants: vi.fn() }))

/** 只在测试注入传输夹具，生产页面没有模拟评价、离线假成功或账号伪造入口。 */
describe('review interactions matching the original site', () => {
  let app: App
  let host: HTMLDivElement
  let pinia: ReturnType<typeof createPinia>
  let router: ReturnType<typeof createRouter>
  let gateway: ReviewGateway
  const settle = async () => {
    for (let i = 0; i < 12; i++) await nextTick()
  }
  const review: ReviewItem = {
    id: '10',
    username: '测试社员',
    createdAt: '2026-10-29T10:00:00+08:00',
    scores: { taste: 8, value: 8, service: 8, ambience: 7.5 },
    recommended: true,
    body: '<script>正文必须按纯文本展示</script>',
    photos: [],
    canDelete: true,
    replies: [],
  }
  beforeEach(async () => {
    vi.resetAllMocks()
    clearAccessToken()
    pinia = createPinia()
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/login', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    host = document.createElement('div')
    document.body.append(host)
    gateway = {
      list: vi.fn().mockResolvedValue([review]),
      publish: vi.fn().mockRejectedValue(new Error('网络失败')),
      reply: vi.fn().mockRejectedValue(new Error('回复网络失败')),
      remove: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(fetchRestaurants).mockResolvedValue({
      page: 1,
      pageSize: 100,
      total: 1,
      totalPages: 1,
      records: [restaurantFixture],
    })
    // jsdom没有原生dialog方法；只补浏览器行为，不改变组件的业务逻辑。
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true
      },
    })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false
      },
    })
  })
  afterEach(() => {
    app?.unmount()
    disposePinia(pinia)
    host.remove()
    clearAccessToken()
    vi.restoreAllMocks()
  })
  function login() {
    setAccessToken('test-session')
    useLoginStore(pinia).user = { id: 1, username: '测试社员', roles: ['USER'] }
  }
  async function mount(component: Component, props = {}) {
    app = createApp({ render: () => h(component, props) })
      .use(pinia)
      .use(router)
      .provide(reviewGatewayKey, gateway)
    app.mount(host)
    await settle()
  }
  async function open() {
    host.querySelector<HTMLButtonElement>('.review-open')!.click()
    await settle()
  }
  async function fill(text: string) {
    const field = host.querySelector<HTMLTextAreaElement>('textarea')!
    field.value = text
    field.dispatchEvent(new Event('input'))
    await settle()
  }
  async function submit() {
    host
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle()
  }

  it('rounds half up, distinguishes zero, and counts Unicode code points', () => {
    expect(overall(review.scores)).toBe(7.88)
    expect(overall({ taste: 0, value: 0, service: 0, ambience: 0 })).toBe(0)
    expect(validBody(' 😀😀😀😀😀 ', 5, 500)).toBe(true)
    expect(validBody('     ', 1, 200)).toBe(false)
    expect(validBody('字'.repeat(501), 5, 500)).toBe(false)
  })
  it('redirects guests to login and preserves the write-review return target', async () => {
    await mount(ReviewComposer)
    await open()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
    expect(router.currentRoute.value.query.redirect).toBe('/?writeReview=1')
    expect(fetchRestaurants).not.toHaveBeenCalled()
  })
  it('loads all restaurant pages, including closed restaurants, with original defaults', async () => {
    login()
    vi.mocked(fetchRestaurants)
      .mockResolvedValueOnce({
        page: 1,
        pageSize: 100,
        total: 101,
        totalPages: 2,
        records: [restaurantFixture],
      })
      .mockResolvedValueOnce({
        page: 2,
        pageSize: 100,
        total: 101,
        totalPages: 2,
        records: [{ ...restaurantFixture, id: '2', name: '停业店', closed: true }],
      })
    await mount(ReviewComposer)
    await open()
    expect(fetchRestaurants).toHaveBeenCalledTimes(2)
    expect(host.querySelector('select')!.textContent).toContain('停业店（已停业）')
    expect(
      [...host.querySelectorAll<HTMLInputElement>('input[type=range]')].map((el) => [
        el.value,
        el.min,
        el.max,
        el.step,
      ]),
    ).toEqual(Array(4).fill(['7', '0', '10', '0.5']))
    expect(host.querySelector('[aria-pressed=true]')?.textContent).toBe('推荐')
    expect(host.textContent).toContain('发布账号：测试社员')
  })
  it('consumes the login return intent once without automatically publishing', async () => {
    login()
    await router.push('/?writeReview=1')
    await mount(ReviewComposer)
    await vi.waitFor(() => expect(router.currentRoute.value.query.writeReview).toBeUndefined())
    expect(host.querySelector('dialog')!.open).toBe(true)
    expect(gateway.publish).not.toHaveBeenCalled()
    host.querySelector<HTMLButtonElement>('[aria-label="关闭评价"]')!.click()
    await settle()
    expect(host.querySelector('dialog')!.open).toBe(false)
  })
  it('validates text, keeps failed drafts and retry IDs, and renews IDs for changed content', async () => {
    login()
    await mount(ReviewComposer)
    await open()
    await submit()
    expect(gateway.publish).not.toHaveBeenCalled()
    await fill('这是一条真实用餐体验')
    await submit()
    await submit()
    const calls = vi.mocked(gateway.publish).mock.calls
    expect(calls[0]![0].clientRequestId).toBe(calls[1]![0].clientRequestId)
    expect(host.querySelector('textarea')!.value).toBe('这是一条真实用餐体验')
    expect(host.textContent).toContain('网络失败')
    await fill('更新过的真实用餐体验')
    await submit()
    expect(calls[2]![0].clientRequestId).not.toBe(calls[0]![0].clientRequestId)
    clearAccessToken()
    await settle()
    expect(host.querySelector('dialog')!.open).toBe(false)
  })
  it('renders safe cards, retains failed replies and reuses the same retry ID', async () => {
    login()
    await mount(ReviewPanel, { restaurantId: '1' })
    expect(host.querySelector('.review-card')!.textContent).toContain('7.88')
    expect(host.querySelector('.body')!.textContent).toBe(review.body)
    expect(host.querySelector('script')).toBeNull()
    const input = host.querySelector('input')!
    input.value = '谢谢分享'
    input.dispatchEvent(new Event('input'))
    await settle()
    await submit()
    await submit()
    expect(gateway.reply).toHaveBeenCalledTimes(2)
    expect(vi.mocked(gateway.reply).mock.calls[0]![2]).toBe(
      vi.mocked(gateway.reply).mock.calls[1]![2],
    )
    expect(input.value).toBe('谢谢分享')
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      isComposing: true,
      cancelable: true,
      bubbles: true,
    })
    input.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
  it('requires confirmation before deletion and refreshes after success', async () => {
    login()
    await mount(ReviewPanel, { restaurantId: '1' })
    const button = [...host.querySelectorAll('button')].find(
      (el) => el.textContent?.trim() === '删除评价',
    )!
    button.click()
    await settle()
    expect(gateway.remove).not.toHaveBeenCalled()
    const confirm = [...host.querySelectorAll('button')].find(
      (el) => el.textContent === '确认删除',
    )!
    confirm.click()
    await settle()
    expect(gateway.remove).toHaveBeenCalledWith('10')
    expect(gateway.list).toHaveBeenCalledTimes(2)
  })
  it('fails explicitly when real review transport is not available', async () => {
    await expect(
      unavailableReviewGateway.publish({
        restaurantId: '1',
        scores: review.scores,
        recommended: true,
        body: '五个字以上',
        photos: [],
        clientRequestId: 'test',
      }),
    ).rejects.toThrow('尚未开放')
  })
})

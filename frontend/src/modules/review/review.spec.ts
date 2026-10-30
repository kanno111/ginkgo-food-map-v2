import { createApp, h, nextTick, ref } from 'vue'
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
      list: vi
        .fn()
        .mockResolvedValue({
          records: [review],
          page: 1,
          pageSize: 8,
          totalGroups: 1,
          totalReviews: 1,
          totalPages: 1,
        }),
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
    expect(host.querySelector('[aria-pressed=true]')?.textContent?.trim()).toBe('推荐')
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
    expect(host.querySelector('dialog')!.open).toBe(true)
    expect(host.querySelector<HTMLButtonElement>('.publish')!.disabled).toBe(true)
    expect(host.querySelector('textarea')!.value).toBe('更新过的真实用餐体验')
    expect(host.querySelector<HTMLTextAreaElement>('.locked-message textarea')!.readOnly).toBe(true)
  })
  it('keeps validation, pending and server errors next to the actual submit button', async () => {
    login()
    await mount(ReviewComposer)
    await open()
    const button = host.querySelector<HTMLButtonElement>('button[type=submit]')!
    button.click()
    await settle()
    expect(gateway.publish).not.toHaveBeenCalled()
    expect(host.querySelector('footer [role=alert]')?.textContent).toContain('请填写5–500字')
    await fill('这是一条提交中的真实用餐体验')
    let reject!: (reason: Error) => void
    vi.mocked(gateway.publish).mockReturnValue(
      new Promise((_, fail) => {
        reject = fail
      }),
    )
    button.click()
    await settle()
    expect(gateway.publish).toHaveBeenCalledTimes(1)
    expect(host.querySelector('footer [role=status]')?.textContent).toContain('正在发布点评')
    const cancel = [...host.querySelectorAll<HTMLButtonElement>('footer button')].find(
      (el) => el.textContent === '取消',
    )!
    expect(cancel.disabled).toBe(true)
    cancel.click()
    expect(host.querySelector('dialog')!.open).toBe(true)
    reject(new Error('网络失败'))
    await settle()
    expect(host.querySelector('footer [role=alert]')?.textContent).toContain('网络失败')
    expect(button.disabled).toBe(false)
  })
  it('shows the server receipt until acknowledged and prevents premature refresh', async () => {
    login()
    vi.mocked(gateway.publish).mockResolvedValue({
      reviewId: '321',
      restaurantId: restaurantFixture.id,
      replayed: true,
    })
    await mount(ReviewComposer)
    await open()
    await fill('这是一条成功的用餐体验')
    await submit()
    expect(host.querySelector('.publish-receipt')?.textContent).toContain('已确认此前发布成功')
    expect(host.querySelector('.receipt-id')?.textContent).toBe('321')
    expect(host.querySelector('dialog')!.open).toBe(true)
    expect(host.querySelector('form')).toBeNull()
    host.querySelector<HTMLButtonElement>('.publish-receipt button')!.click()
    await settle()
    expect(host.querySelector('dialog')!.open).toBe(false)
  })
  it('marks text-only capability and removes misleading restaurant predictions', async () => {
    login()
    gateway.supportsPhotos = false
    await mount(ReviewComposer)
    await open()
    expect(host.querySelector<HTMLInputElement>('input[type=file]')!.disabled).toBe(true)
    expect(host.textContent).toContain('本次仅支持文字点评')
    expect(host.textContent).not.toContain('预测综合分')
  })
  it('keeps the dialog and fields frozen while the publish request is in flight', async () => {
    login()
    let resolve!: () => void
    vi.mocked(gateway.publish).mockReturnValue(
      new Promise<void>((r) => {
        resolve = r
      }),
    )
    await mount(ReviewComposer)
    await open()
    await fill('这是一条提交中的用餐体验')
    await submit()
    expect(host.querySelector<HTMLFieldSetElement>('.review-inputs')!.disabled).toBe(true)
    expect(host.querySelector<HTMLButtonElement>('[aria-label="关闭评价"]')!.disabled).toBe(true)
    host.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true }))
    await settle()
    expect(host.querySelector('dialog')!.open).toBe(true)
    resolve()
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
  it('paginates author groups and resets to page one on refresh or publication', async () => {
    gateway.supportsReplies = false
    gateway.list = vi.fn().mockImplementation(async (_id, _signal, page = 1) => ({
      records: [{ ...review, id: String(page), historyCount: 2, canDelete: false }],
      page,
      pageSize: 8,
      totalGroups: 9,
      totalReviews: 12,
      totalPages: 2,
    }))
    const revision = ref(0)
    await mount({
      setup: () => () => h(ReviewPanel, { restaurantId: '1', revision: revision.value }),
    })
    expect(host.textContent).toContain('9位同学 · 12条点评')
    expect(host.textContent).toContain('2条历史点评')
    expect(host.querySelector('form')).toBeNull()
    const click = async (name: string) => {
      ;[...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)!.click()
      await settle()
    }
    await click('下一页点评')
    expect(host.textContent).toContain('第2 / 2页')
    await click('刷新评价')
    expect(host.textContent).toContain('第1 / 2页')
    await click('下一页点评')
    revision.value++
    await settle()
    expect(host.textContent).toContain('第1 / 2页')
    expect(vi.mocked(gateway.list).mock.calls.map((c) => c[2])).toEqual([1, 2, 1, 2, 1])
  })
  it('retries the failed page without displaying a false empty state', async () => {
    const data = (page: number) => ({
      records: [review],
      page,
      pageSize: 8,
      totalGroups: 9,
      totalReviews: 9,
      totalPages: 2,
    })
    gateway.list = vi
      .fn()
      .mockResolvedValueOnce(data(1))
      .mockRejectedValueOnce(new Error('网络失败'))
      .mockResolvedValueOnce(data(2))
    await mount(ReviewPanel, { restaurantId: '1' })
    ;[...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === '下一页点评')!.click()
    await settle()
    expect(host.querySelector('[role=alert]')?.textContent).toContain('网络失败')
    expect(host.querySelector('.empty')).toBeNull()
    ;[...host.querySelectorAll('button')].find((b) => b.textContent === '重试')!.click()
    await settle()
    expect(host.textContent).toContain('第2 / 2页')
    expect(vi.mocked(gateway.list).mock.calls.map((c) => c[2])).toEqual([1, 2, 2])
  })
  it('aborts the previous restaurant and ignores its late response', async () => {
    const pending: { resolve: (value: unknown) => void; signal: AbortSignal }[] = []
    gateway.list = vi
      .fn()
      .mockImplementation(
        (_id, signal) => new Promise((resolve) => pending.push({ resolve, signal })),
      )
    const id = ref('1')
    await mount({ setup: () => () => h(ReviewPanel, { restaurantId: id.value }) })
    id.value = '2'
    await settle()
    expect(pending[0]!.signal.aborted).toBe(true)
    const data = (body: string) => ({
      records: [{ ...review, body }],
      page: 1,
      pageSize: 8,
      totalGroups: 1,
      totalReviews: 1,
      totalPages: 1,
    })
    pending[1]!.resolve(data('新餐厅点评'))
    await settle()
    pending[0]!.resolve(data('旧餐厅点评'))
    await settle()
    expect(host.textContent).toContain('新餐厅点评')
    expect(host.textContent).not.toContain('旧餐厅点评')
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

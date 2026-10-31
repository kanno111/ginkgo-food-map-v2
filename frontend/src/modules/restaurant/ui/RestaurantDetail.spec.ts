/* eslint-disable vue/one-component-per-file -- 独立桩组件用于验证详情刷新时的挂载稳定性。 */
import { createPinia } from 'pinia'
import { AxiosError, AxiosHeaders } from 'axios'
import { createApp, h, nextTick, ref } from 'vue'
import type { App } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchRestaurant } from '../api/restaurantApi'
import { restaurantFixture } from '../api/restaurant.test-data'
import RestaurantDetail from './RestaurantDetail.vue'

vi.mock('../api/restaurantApi', () => ({ fetchRestaurant: vi.fn() }))
// 只模拟发布确认事件，验证详情统计生命周期；真实发布/回复由各自的集成测试覆盖。
vi.mock('@/modules/review', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    ReviewComposer: defineComponent({
      emits: ['published'],
      setup(_, { emit }) {
        return () =>
          h('button', { class: 'test-publish', onClick: () => emit('published') }, '确认发布')
      },
    }),
    ReviewPanel: defineComponent({
      props: { restaurantId: String, revision: Number },
      setup(props) {
        return () =>
          h(
            'div',
            { class: 'test-review-panel', 'data-revision': props.revision },
            props.restaurantId,
          )
      },
    }),
    ScoreRadar: defineComponent({
      setup() {
        return () => h('div')
      },
    }),
  }
})

/** 直达链接独立请求；只有404展示缺失页，故障可重试，剪贴板仍保留降级。 */
describe('restaurant detail API integration', () => {
  let app: App | undefined
  let host: HTMLDivElement
  const currentId = ref(restaurantFixture.id)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/', '/scoring-guide'].map((path) => ({ path, component: { template: '<div />' } })),
  })
  const settle = async () => {
    for (let i = 0; i < 6; i++) await nextTick()
  }
  beforeEach(async () => {
    vi.resetAllMocks()
    vi.mocked(fetchRestaurant).mockResolvedValue(restaurantFixture)
    currentId.value = restaurantFixture.id
    await router.push('/')
    host = document.createElement('div')
    document.body.append(host)
  })
  afterEach(() => {
    app?.unmount()
    host.remove()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  async function mount() {
    app = createApp({ render: () => h(RestaurantDetail, { id: currentId.value }) })
      .use(router)
      .use(createPinia())
    app.mount(host)
    await settle()
  }

  it('loads the direct ID and preserves unknown values and demo labels', async () => {
    await mount()
    expect(fetchRestaurant).toHaveBeenCalledWith(restaurantFixture.id, expect.any(AbortSignal))
    expect(host.querySelector('h1')?.textContent).toBe(restaurantFixture.name)
    expect(host.querySelector('.detail-preview')?.textContent).toContain('联调模拟')
    expect(host.querySelector('.detail-cup')).toBeNull()
    expect(host.textContent).not.toContain('待评级')
    expect(host.querySelector('.score-summary')?.textContent).toContain('—')
    expect(host.querySelector('.detail-subtitle')?.textContent).toContain('人均待补')
    expect(host.querySelector('.distance-note')?.textContent).toContain('位置尚未确认')
  })

  it('distinguishes a missing record from a temporary server failure', async () => {
    const headers = new AxiosHeaders()
    vi.mocked(fetchRestaurant).mockRejectedValueOnce(
      new AxiosError('missing', '', undefined, undefined, {
        status: 404,
        statusText: '',
        data: {},
        headers,
        config: { headers },
      }),
    )
    await mount()
    expect(host.querySelector('h1')?.textContent).toBe('没有找到这家店。')
    vi.mocked(fetchRestaurant).mockRejectedValueOnce(new Error('服务暂不可用'))
    currentId.value = '2'
    await settle()
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('服务暂不可用')
    host.querySelector<HTMLButtonElement>('[role="alert"] button')!.click()
    await settle()
    expect(host.querySelector('h1')?.textContent).toBe(restaurantFixture.name)
  })

  it('offers manual copy when clipboard fails and shares the database ID', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    await mount()
    host.querySelector<HTMLButtonElement>('.share-button')!.click()
    await settle()
    expect(host.querySelector('.copy-feedback')?.textContent).toContain('手动复制')
    const text = host.querySelector<HTMLTextAreaElement>('.manual-copy textarea')?.value
    expect(text).toContain(`/restaurants/${restaurantFixture.id}`)
    expect(text).toContain('联调模拟数据')
  })

  it('ignores the previous restaurant response after switching routes', async () => {
    let resolveOld!: (value: typeof restaurantFixture) => void
    vi.mocked(fetchRestaurant).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve
      }),
    )
    await mount()
    expect(host.querySelector('[role="status"]')?.textContent).toContain('正在加载')
    currentId.value = '2'
    await settle()
    resolveOld({ ...restaurantFixture, name: '过期响应' })
    await settle()
    expect(host.querySelector('h1')?.textContent).toBe(restaurantFixture.name)
  })

  it('shows effective participants independently from history count and preserves a real zero', async () => {
    vi.mocked(fetchRestaurant).mockResolvedValueOnce({
      ...restaurantFixture,
      score: 0,
      recommendRate: 0,
      participantCount: 2,
      reviewCount: 7,
    })
    await mount()
    const text = host.querySelector('.score-summary')!.textContent!
    expect(text).toContain('0.0')
    expect(text).toContain('0%')
    expect(text).toMatch(/2\s*人\s*·\s*7\s*条点评/)
  })

  it('refreshes statistics after acknowledgement without unmounting reviews and retries reading separately', async () => {
    await mount()
    const panel = host.querySelector('.test-review-panel')!
    vi.mocked(fetchRestaurant).mockRejectedValueOnce(new Error('刷新断网'))
    host.querySelector<HTMLButtonElement>('.test-publish')!.click()
    await settle()
    expect(host.querySelector('.test-review-panel')).toBe(panel)
    expect(panel.getAttribute('data-revision')).toBe('1')
    expect(host.querySelector('.panel-note[role="alert"]')?.textContent).toContain('评分刷新失败')
    vi.mocked(fetchRestaurant).mockResolvedValueOnce({
      ...restaurantFixture,
      score: 7.5,
      participantCount: 2,
      reviewCount: 3,
    })
    host.querySelector<HTMLButtonElement>('.panel-note[role="alert"] button')!.click()
    await settle()
    expect(host.querySelector('.score-summary')?.textContent).toContain('7.5')
    expect(host.querySelector('.panel-note[role="alert"]')).toBeNull()
    expect(host.querySelector('.test-review-panel')).toBe(panel)
    expect(panel.getAttribute('data-revision')).toBe('1')
  })

  it('ignores old statistics if the route changes while refreshing', async () => {
    await mount()
    let old!: (value: typeof restaurantFixture) => void
    vi.mocked(fetchRestaurant).mockReturnValueOnce(
      new Promise((resolve) => {
        old = resolve
      }),
    )
    host.querySelector<HTMLButtonElement>('.test-publish')!.click()
    await settle()
    vi.mocked(fetchRestaurant).mockResolvedValueOnce({
      ...restaurantFixture,
      id: '2',
      name: '新餐厅',
      score: 6,
    })
    currentId.value = '2'
    await settle()
    old({ ...restaurantFixture, name: '旧统计覆盖', score: 10 })
    await settle()
    expect(host.querySelector('h1')?.textContent).toBe('新餐厅')
    expect(host.querySelector('.score-summary')?.textContent).toContain('6.0')
  })
})

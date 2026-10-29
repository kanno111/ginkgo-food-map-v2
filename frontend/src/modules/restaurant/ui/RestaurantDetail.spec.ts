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
    expect(host.querySelector('.detail-cup')?.textContent).toContain('待评级')
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
})

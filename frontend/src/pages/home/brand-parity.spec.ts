import { createApp } from 'vue'
import type { App } from 'vue'
import { createPinia, disposePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HomePage from './HomePage.vue'

// 视觉契约不依赖网络；餐厅HTTP行为由独立接入测试覆盖。
vi.mock('@/modules/restaurant/api/restaurantApi', () => ({
  fetchRestaurantCategories: vi.fn().mockResolvedValue([]),
  fetchRestaurants: vi.fn().mockResolvedValue({ records: [], total: 0, totalPages: 0 }),
}))

// 原版素材与文案是用户明确要求保留的产品约束，用固定基准防止后续设计再次替换。
describe('original Ginkgo brand parity', () => {
  let app: App | undefined
  let host: HTMLDivElement | undefined
  let pinia: ReturnType<typeof createPinia> | undefined
  afterEach(() => {
    app?.unmount()
    if (pinia) disposePinia(pinia)
    app = undefined
    host?.remove()
    host = undefined
  })

  it('uses the approved restaurant-first layout and retains brand assets', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: HomePage },
        { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    host = document.createElement('div')
    document.body.append(host)
    pinia = createPinia()
    app = createApp(HomePage).use(pinia).use(router)
    app.mount(host)
    expect(host.querySelector('h1')?.textContent).toBe('Ginkgo 美食地图')
    expect(host.querySelector('.discovery-footer figcaption')?.textContent).toBe(
      '不好吃，就举牌子。',
    )
    expect(host.querySelector('.discovery-footer img')?.getAttribute('src')).toContain(
      'ginkgo-cover.jpg',
    )
    expect(host.querySelector('.random-banner')?.textContent).toContain('今天吃什么')
    expect(host.textContent).not.toContain('看点评')
  })
})

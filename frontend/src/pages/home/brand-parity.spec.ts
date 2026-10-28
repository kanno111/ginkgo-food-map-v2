import { createApp, h } from 'vue'
import type { App } from 'vue'
import { createPinia, disposePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CupBadge, cupTiers } from '@/modules/restaurant'
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

  it.each([
    ['bucket', '全家桶', '#C0392B', '神店，冲', '#FFFFFF'],
    ['super', '超大杯', '#B5651D', '强推', '#FFFFFF'],
    ['large', '大杯', '#C98A4B', '值得一去', '#FFFFFF'],
    ['medium', '中杯', '#D8B98A', '中规中矩', '#2B2A26'],
    ['small', '小杯', '#8A94A6', '踩雷预警', '#FFFFFF'],
    ['none', '待评级', '#B9B2A4', '等你来评', '#2B2A26'],
  ] as const)(
    'preserves original %s glyph, colors and slogan',
    (tier, label, color, slogan, fg) => {
      host = document.createElement('div')
      document.body.append(host)
      app = createApp({ render: () => h(CupBadge, { tier }) })
      app.mount(host)
      const badge = host.querySelector<HTMLElement>('.cup-badge')!
      expect(cupTiers.find((definition) => definition.key === tier)).toMatchObject({
        label,
        color,
        description: slogan,
      })
      expect(badge.title).toBe(slogan)
      expect(badge.style.getPropertyValue('--cup-color')).toBe(color)
      expect(badge.style.color).toBe(fg === '#FFFFFF' ? 'rgb(255, 255, 255)' : 'rgb(43, 42, 38)')
      expect([...badge.querySelectorAll('path')].map((path) => path.getAttribute('d'))).toEqual([
        'M6.3 8.1h11.4l-1.35 10.2H7.65Z',
        'M17 10.1h1.25a2.05 2.05 0 0 1 0 4.1h-1.05',
        'M5.3 5.7h13.4',
      ])
      expect(badge.querySelector('path')?.getAttribute('stroke')).toBe(
        tier === 'bucket' ? '#E9B949' : 'rgba(255,255,255,0.35)',
      )
    },
  )

  it('shows the original hero copy, cover caption and tier slogans', async () => {
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
    expect(host.querySelector('.hero-description')?.textContent?.trim()).toBe(
      '电子科技大学 Ginkgo 烹饪社 · 成都觅食指南。吃了就打分，按杯型论英雄——不好吃就举牌子。',
    )
    expect(host.querySelector('.eyebrow')?.textContent?.trim()).toBe(
      'UNIVERSITY OF ELECTRONIC SCIENCE AND TECHNOLOGY OF CHINA',
    )
    expect(host.querySelector('.hero-cover figcaption')?.textContent).toBe('不好吃，就举牌子。')
    expect(host.querySelector('.hero-cover img')?.getAttribute('src')).toContain('ginkgo-cover.jpg')
    expect(
      [...host.querySelectorAll('.invitation-cups small')].map((element) => element.textContent),
    ).toEqual(['神店，冲', '强推', '值得一去', '中规中矩', '踩雷预警'])
  })
})

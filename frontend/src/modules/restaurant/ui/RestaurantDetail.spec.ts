import { createApp, nextTick } from 'vue'
import type { App } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RestaurantDetail from './RestaurantDetail.vue'

/** 验证直达详情、缺失页面和剪贴板降级，不将旧目录解释为真实已营业数据。 */
describe('restaurant detail preview', () => {
  let app: App | undefined
  let host: HTMLDivElement
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/', '/scoring-guide'].map((path) => ({ path, component: { template: '<div />' } })),
  })
  beforeEach(async () => {
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
  function mount(id: string) {
    app = createApp(RestaurantDetail, { id }).use(router)
    app.mount(host)
  }

  it('shows the original candidate with explicit unrated and estimated values', () => {
    mount('r01')
    expect(host.querySelector('h1')?.textContent).toBe('银桦餐厅')
    expect(host.querySelector('.detail-preview')?.textContent).toContain('尚未核实')
    expect(host.querySelector('.detail-cup')?.textContent).toContain('待评级')
    expect(host.querySelector('.score-summary')?.textContent).toContain('—')
    expect(host.querySelector('.price-note')?.textContent).toContain('仅为估值')
    expect(host.querySelector('.review-empty')?.textContent).toContain('暂不支持发布评价')
  })

  it('offers a useful fallback for a missing direct restaurant link', () => {
    mount('unknown')
    expect(host.querySelector('h1')?.textContent).toBe('没有找到这家店。')
    expect(host.querySelector('.primary-action')?.getAttribute('href')).toBe('/')
  })

  it('provides manual copy text when clipboard access fails', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    mount('r01')
    host.querySelector<HTMLButtonElement>('.address-panel button')!.click()
    await nextTick()
    await nextTick()
    expect(host.querySelector('.copy-feedback')?.textContent).toContain('手动复制')
    expect(host.querySelector<HTMLTextAreaElement>('textarea')?.value).toContain('清水河校区')
  })
})

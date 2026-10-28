import { createApp, nextTick } from 'vue'
import type { App } from 'vue'
import { createPinia, disposePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchRestaurantCategories, fetchRestaurants } from '../api/restaurantApi'
import { categoryFixtures, pageFixture } from '../api/restaurant.test-data'
import { useRestaurantCatalog } from '../model/catalog.store'
import RestaurantCatalog from './RestaurantCatalog.vue'

vi.mock('../api/restaurantApi', () => ({
  fetchRestaurantCategories: vi.fn(),
  fetchRestaurants: vi.fn(),
}))

/** 验证页面使用服务端总数和当前页，网络错误不能回退到旧预览快照。 */
describe('restaurant catalog API integration', () => {
  let app: App
  let host: HTMLDivElement
  let pinia: ReturnType<typeof createPinia>
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/', '/restaurants/:id', '/scoring-guide'].map((path) => ({
      path,
      component: { template: '<div />' },
    })),
  })
  const settle = async () => {
    for (let i = 0; i < 8; i++) await nextTick()
  }
  beforeEach(async () => {
    vi.resetAllMocks()
    vi.mocked(fetchRestaurantCategories).mockResolvedValue(categoryFixtures)
    vi.mocked(fetchRestaurants).mockResolvedValue(pageFixture())
    pinia = createPinia()
    await router.push('/')
    host = document.createElement('div')
    document.body.append(host)
    app = createApp(RestaurantCatalog).use(pinia).use(router)
    app.mount(host)
    await settle()
  })
  afterEach(() => {
    app.unmount()
    disposePinia(pinia)
    host.remove()
  })

  it('shows server records and total with demo provenance and numeric links', () => {
    expect(host.querySelector('[role="note"]')?.textContent).toContain('联调模拟')
    expect(host.querySelectorAll('.restaurant-card')).toHaveLength(8)
    expect(host.querySelector('.results-toolbar')?.textContent).toContain('25')
    expect(host.querySelector('.restaurant-card')?.getAttribute('href')).toBe('/restaurants/1')
    expect(host.textContent).not.toContain('银桦餐厅')
  })

  it('sends category codes and keeps collapsed advanced filters active', async () => {
    const toggle = host.querySelector<HTMLButtonElement>('.mobile-filter-toggle')!
    toggle.click()
    await settle()
    const category = [...host.querySelectorAll<HTMLButtonElement>('.category-filter button')].find(
      (button) => button.textContent?.trim() === '火锅',
    )!
    category.click()
    await settle()
    expect(useRestaurantCatalog(pinia).filters.category).toBe('HOT_POT')
    expect(fetchRestaurants).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: 'HOT_POT' }),
      1,
      8,
      expect.any(AbortSignal),
    )
    expect(toggle.textContent).toContain('已选 1 项')
    toggle.click()
    await settle()
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(useRestaurantCatalog(pinia).filters.category).toBe('HOT_POT')
  })

  it('keeps focus behavior when requesting the next server page', async () => {
    const next = [...host.querySelectorAll<HTMLButtonElement>('.catalog-pagination button')].find(
      (button) => button.textContent?.includes('下一页'),
    )!
    next.click()
    await settle()
    expect(fetchRestaurants).toHaveBeenLastCalledWith(
      expect.anything(),
      2,
      8,
      expect.any(AbortSignal),
    )
    expect(document.activeElement).toBe(host.querySelector('.results-toolbar'))
  })

  it('shows server emptiness without inventing low scores', async () => {
    vi.mocked(fetchRestaurants).mockResolvedValue(
      pageFixture({ total: 0, totalPages: 0, records: [] }),
    )
    useRestaurantCatalog(pinia).toggleTier('small')
    await settle()
    expect(host.querySelector('.directory-empty')?.textContent).toContain('待评级')
    expect(host.querySelectorAll('.restaurant-card')).toHaveLength(0)
  })

  it('shows failure and retries instead of displaying preview restaurants', async () => {
    vi.mocked(fetchRestaurants).mockRejectedValueOnce(new Error('联调网络故障'))
    await useRestaurantCatalog(pinia).load()
    await settle()
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('联调网络故障')
    expect(host.querySelectorAll('.restaurant-card')).toHaveLength(0)
    host.querySelector<HTMLButtonElement>('[role="alert"] button')!.click()
    await settle()
    expect(host.querySelector('[role="alert"]')).toBeNull()
    expect(host.querySelectorAll('.restaurant-card')).toHaveLength(8)
  })
})

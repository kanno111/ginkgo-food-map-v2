import { createApp, nextTick } from 'vue'
import type { App } from 'vue'
import { createPinia, disposePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useRestaurantCatalog } from '../model/catalog.store'
import RestaurantCatalog from './RestaurantCatalog.vue'

/** 在真实DOM中验证筛选与分页联动，预览不需要登录或访问不存在的餐厅接口。 */
describe('restaurant catalog preview', () => {
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

  beforeEach(async () => {
    pinia = createPinia()
    await router.push('/')
    host = document.createElement('div')
    document.body.append(host)
    app = createApp(RestaurantCatalog).use(pinia).use(router)
    app.mount(host)
  })
  afterEach(() => {
    app.unmount()
    disposePinia(pinia)
    host.remove()
  })

  it('labels data provenance and renders one page of unrated candidates', () => {
    expect(host.querySelector('[role="note"]')?.textContent).toContain('仅供界面预览')
    expect(host.querySelectorAll('.restaurant-card')).toHaveLength(8)
    expect(host.querySelector('.results-toolbar')?.textContent).toContain('25')
    expect(host.querySelectorAll('.restaurant-card .cup-badge').length).toBe(8)
    expect(host.querySelector('.restaurant-card')?.getAttribute('href')).toMatch(
      /^\/restaurants\/r/,
    )
  })

  it('resets the current page when search changes and handles an empty result', async () => {
    const store = useRestaurantCatalog(pinia)
    store.goToPage(4)
    await nextTick()
    expect(host.querySelectorAll('.restaurant-card')).toHaveLength(1)
    const input = host.querySelector<HTMLInputElement>('#restaurant-search')!
    input.value = '不存在的餐厅'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(store.page).toBe(1)
    expect(host.querySelectorAll('.restaurant-card')).toHaveLength(0)
    expect(host.querySelector('.directory-empty')?.textContent).toContain('没有找到符合条件')
    host.querySelector<HTMLButtonElement>('.directory-empty button')!.click()
    await nextTick()
    expect(host.querySelectorAll('.restaurant-card')).toHaveLength(8)
  })

  it('does not describe unrated candidates as pitfalls and supports cup multi-selection', async () => {
    const store = useRestaurantCatalog(pinia)
    store.toggleTier('small')
    await nextTick()
    expect(host.querySelector('.directory-empty')?.textContent).toContain('所有店铺均为待评级')
    store.toggleTier('none')
    await nextTick()
    expect(store.results).toHaveLength(25)
    expect(host.querySelectorAll('.restaurant-card')).toHaveLength(8)
  })

  it('filters categories and original closure flags, with bounded pagination', async () => {
    const store = useRestaurantCatalog(pinia)
    store.filters.category = '火锅'
    await nextTick()
    expect(host.querySelectorAll('.restaurant-card')).toHaveLength(4)
    store.resetFilters()
    store.filters.hideClosed = true
    expect(store.results).toHaveLength(24)
    store.goToPage(999)
    expect(store.page).toBe(store.pages)
    store.goToPage(-2)
    expect(store.page).toBe(1)
    store.goToPage(NaN)
    expect(store.page).toBe(1)
  })

  it('collapses advanced controls without losing their conditions and resets the summary', async () => {
    const toggle = host.querySelector<HTMLButtonElement>('.mobile-filter-toggle')!
    const panel = host.querySelector('#advanced-filters')!
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    toggle.click()
    await nextTick()
    expect(panel.classList.contains('expanded')).toBe(true)
    const category = [...host.querySelectorAll<HTMLButtonElement>('.category-filter button')].find(
      (button) => button.textContent?.trim() === '火锅',
    )!
    category.click()
    await nextTick()
    expect(toggle.textContent).toContain('已选 1 项')
    toggle.click()
    await nextTick()
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(panel.classList.contains('expanded')).toBe(false)
    expect(host.querySelectorAll('.restaurant-card')).toHaveLength(4)
    host.querySelector<HTMLButtonElement>('.filter-title button')!.click()
    await nextTick()
    expect(toggle.textContent).not.toContain('已选')
    expect(host.querySelectorAll('.restaurant-card')).toHaveLength(8)
  })

  it('moves keyboard focus to the result summary after pagination', async () => {
    const nextPage = [
      ...host.querySelectorAll<HTMLButtonElement>('.catalog-pagination button'),
    ].find((button) => button.textContent?.includes('下一页'))!
    nextPage.click()
    await nextTick()
    expect(useRestaurantCatalog(pinia).page).toBe(2)
    expect(document.activeElement).toBe(host.querySelector('.results-toolbar'))
  })
})

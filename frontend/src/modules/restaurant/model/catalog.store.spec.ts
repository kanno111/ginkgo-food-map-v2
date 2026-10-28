import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchRestaurantCategories, fetchRestaurants } from '../api/restaurantApi'
import type { RestaurantPage } from '../api/restaurantApi'
import { categoryFixtures, pageFixture } from '../api/restaurant.test-data'
import { useRestaurantCatalog } from './catalog.store'

vi.mock('../api/restaurantApi', () => ({
  fetchRestaurantCategories: vi.fn(),
  fetchRestaurants: vi.fn(),
}))

/** 网络乱序、搜索防抖和服务端分页是本次接入的边界，不能由快照筛选测试代替。 */
describe('server restaurant catalog state', () => {
  let pinia: ReturnType<typeof createPinia>
  const settle = async () => {
    for (let i = 0; i < 8; i++) await nextTick()
  }
  beforeEach(() => {
    vi.resetAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)
    vi.mocked(fetchRestaurantCategories).mockResolvedValue(categoryFixtures)
    vi.mocked(fetchRestaurants).mockResolvedValue(pageFixture())
  })
  afterEach(() => {
    disposePinia(pinia)
    vi.useRealTimers()
  })

  it('preserves server ordering and counts instead of filtering or slicing the page', async () => {
    const result = pageFixture({ total: 185, totalPages: 24 })
    result.records[0]!.name = 'Z服务端第一名'
    result.records[1]!.name = 'A服务端第二名'
    vi.mocked(fetchRestaurants).mockResolvedValue(result)
    const store = useRestaurantCatalog()
    await store.load()
    expect(store.total).toBe(185)
    expect(store.visibleRestaurants).toEqual(result.records)
    expect(store.pageNumbers.length).toBeLessThanOrEqual(7)
    store.goToPage(2)
    await settle()
    expect(fetchRestaurants).toHaveBeenLastCalledWith(
      expect.anything(),
      2,
      8,
      expect.any(AbortSignal),
    )
    expect(store.visibleRestaurants).toHaveLength(8)
  })

  it('discards stale responses even when the network ignores cancellation', async () => {
    let resolveOld!: (value: RestaurantPage) => void
    vi.mocked(fetchRestaurants).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve
      }),
    )
    const store = useRestaurantCatalog()
    const oldRequest = store.load()
    const previousSignal = vi.mocked(fetchRestaurants).mock.calls[0]![3]!
    store.filters.category = 'HOT_POT'
    await settle()
    expect(previousSignal.aborted).toBe(true)
    resolveOld(pageFixture({ total: 999, records: [] }))
    await oldRequest
    expect(store.total).toBe(25)
    expect(store.visibleRestaurants).toHaveLength(8)
  })

  it('debounces keywords, resets pagination, and sends only the latest keyword', async () => {
    vi.useFakeTimers()
    const store = useRestaurantCatalog()
    await store.load()
    store.goToPage(4)
    await settle()
    vi.mocked(fetchRestaurants).mockClear()
    store.filters.keyword = '火'
    await settle()
    store.filters.keyword = '火锅'
    await settle()
    expect(store.page).toBe(1)
    expect(fetchRestaurants).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(250)
    expect(fetchRestaurants).toHaveBeenCalledTimes(1)
    expect(fetchRestaurants).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: '火锅' }),
      1,
      8,
      expect.any(AbortSignal),
    )
  })

  it('reloads the remaining last page when deletion reduces the page count', async () => {
    const store = useRestaurantCatalog()
    await store.load()
    vi.mocked(fetchRestaurants).mockResolvedValue(pageFixture({ total: 1, totalPages: 1 }))
    store.goToPage(4)
    await settle()
    expect(store.page).toBe(1)
    expect(fetchRestaurants).toHaveBeenLastCalledWith(
      expect.anything(),
      1,
      8,
      expect.any(AbortSignal),
    )
    expect(store.total).toBe(1)
  })

  it('clears failed results, retries dictionary loading, and never falls back to preview data', async () => {
    vi.mocked(fetchRestaurantCategories).mockRejectedValueOnce(new Error('分类暂不可用'))
    const store = useRestaurantCatalog()
    await store.load()
    expect(store.error).toBe('分类暂不可用')
    expect(store.visibleRestaurants).toEqual([])
    await store.load()
    expect(store.error).toBeNull()
    expect(store.categories).toEqual(categoryFixtures)
    expect(store.visibleRestaurants).toHaveLength(8)
  })

  it('cancels pending search when leaving the page', async () => {
    vi.useFakeTimers()
    const store = useRestaurantCatalog()
    await store.load()
    vi.mocked(fetchRestaurants).mockClear()
    store.filters.keyword = '未发出的搜索'
    await settle()
    store.cancelPending()
    await vi.advanceTimersByTimeAsync(300)
    expect(fetchRestaurants).not.toHaveBeenCalled()
  })
})

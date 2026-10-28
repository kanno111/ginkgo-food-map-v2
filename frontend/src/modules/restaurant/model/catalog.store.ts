import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import { previewRestaurants } from './catalog.preview'
import { filterRestaurants } from './catalog.logic'
import type { CatalogFilters, CupTier } from './restaurant.types'

/** 只读预览目录；所有记录明确来自旧版候选，不访问或模拟尚未存在的餐厅HTTP接口。 */
export const useRestaurantCatalog = defineStore('restaurant-catalog', () => {
  const filters = reactive<CatalogFilters>({
    keyword: '',
    category: '',
    tiers: [],
    view: 'all',
    sort: 'score',
    hideClosed: false,
  })
  const page = ref(1)
  const pageSize = 8
  const results = computed(() => filterRestaurants(previewRestaurants, filters))
  const pages = computed(() => Math.max(1, Math.ceil(results.value.length / pageSize)))
  const visibleRestaurants = computed(() =>
    results.value.slice((page.value - 1) * pageSize, page.value * pageSize),
  )
  const categories = [...new Set(previewRestaurants.map((restaurant) => restaurant.category))]

  // 任一筛选变化都从第一页开始，避免旧页码落到空页；同步执行保证键盘与快速连续操作一致。
  watch(
    filters,
    () => {
      page.value = 1
    },
    { deep: true, flush: 'sync' },
  )

  /** “全部”清空杯型组合，其余选项可多选，待评级与小杯始终为不同类别。 */
  function toggleTier(tier: CupTier): void {
    filters.tiers = filters.tiers.includes(tier)
      ? filters.tiers.filter((value) => value !== tier)
      : [...filters.tiers, tier]
  }

  /** 统一清理所有条件，也用于无结果页恢复目录。 */
  function resetFilters(): void {
    Object.assign(filters, {
      keyword: '',
      category: '',
      tiers: [],
      view: 'all',
      sort: 'score',
      hideClosed: false,
    })
    page.value = 1
  }

  /** 分页入口限制有效范围，不允许无结果时跳到不存在的一页。 */
  function goToPage(value: number): void {
    if (!Number.isFinite(value)) return
    page.value = Math.min(pages.value, Math.max(1, Math.trunc(value)))
  }

  return {
    filters,
    page,
    pageSize,
    results,
    pages,
    visibleRestaurants,
    categories,
    toggleTier,
    resetFilters,
    goToPage,
  }
})

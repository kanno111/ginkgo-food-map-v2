import type {
  CatalogFilters,
  CupTier,
  RatingDimension,
  RestaurantReadModel,
} from './restaurant.types'

/** 阈值、颜色与标语逐项沿用原版 TIERS/TIER_NONE；待评级不能当成踩雷。 */
export const cupTiers: {
  key: CupTier
  label: string
  range: string
  color: string
  description: string
}[] = [
  {
    key: 'bucket',
    label: '全家桶',
    range: '8.6–10',
    color: '#C0392B',
    description: '神店，冲',
  },
  { key: 'super', label: '超大杯', range: '7.4–8.6', color: '#B5651D', description: '强推' },
  { key: 'large', label: '大杯', range: '6.2–7.4', color: '#C98A4B', description: '值得一去' },
  { key: 'medium', label: '中杯', range: '5.0–6.2', color: '#D8B98A', description: '中规中矩' },
  { key: 'small', label: '小杯', range: '0–5.0', color: '#8A94A6', description: '踩雷预警' },
  {
    key: 'none',
    label: '待评级',
    range: '暂无评价',
    color: '#B9B2A4',
    description: '等你来评',
  },
]

export const ratingDimensions: { key: RatingDimension; label: string; description: string }[] = [
  { key: 'taste', label: '味道', description: '调味、火候与食材，吃完还想不想再来。' },
  { key: 'value', label: '性价比', description: '从学生的预算出发，这一餐值不值得。' },
  { key: 'service', label: '服务', description: '态度、出餐速度，以及用餐中的照顾。' },
  { key: 'ambience', label: '环境', description: '卫生、座位与噪音，能否舒服吃顿饭。' },
]

/** 只按原始分数判档，显示为8.6的8.55仍属于超大杯；不在前端伪造聚合分数。 */
export function tierOf(score: number | null): CupTier {
  if (score === null || !Number.isFinite(score) || score < 0 || score > 10) return 'none'
  if (score >= 8.6) return 'bucket'
  if (score >= 7.4) return 'super'
  if (score >= 6.2) return 'large'
  if (score >= 5) return 'medium'
  return 'small'
}

/** 参考点为清水河校区，计算直线公里数；位置未确认时不显示虚构距离。 */
export function campusDistance(restaurant: RestaurantReadModel): number | null {
  if (restaurant.distanceKm !== undefined) return restaurant.distanceKm
  const { latitude, longitude } = restaurant
  if (
    restaurant.needsLocation ||
    latitude === null ||
    longitude === null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return null
  const rad = Math.PI / 180
  const dLat = (latitude - 30.7544) * rad
  const dLng = (longitude - 103.9312) * rad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(30.7544 * rad) * Math.cos(latitude * rad) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)))
}

/** 金额来源同时展示，旧档位估值不能被当成已核实的精确消费。 */
export function priceLabel(restaurant: RestaurantReadModel): string {
  if (restaurant.price === null || restaurant.price <= 0) return '人均待补'
  return `${restaurant.priceKind === 'estimate' ? '约 ' : ''}¥${restaurant.price}`
}

/** 客户端预览筛选：将来由服务端提供分页时替换数据来源，不将当前页误当完整集合。 */
export function filterRestaurants(
  restaurants: RestaurantReadModel[],
  filters: CatalogFilters,
): RestaurantReadModel[] {
  const keyword = filters.keyword.trim().toLocaleLowerCase()
  const result = restaurants.filter((restaurant) => {
    if (filters.hideClosed && restaurant.closed) return false
    if (filters.category && restaurant.category !== filters.category) return false
    if (
      keyword &&
      ![restaurant.name, restaurant.address, restaurant.category, ...restaurant.tags]
        .join(' ')
        .toLocaleLowerCase()
        .includes(keyword)
    )
      return false
    const tier = tierOf(restaurant.score)
    if (filters.tiers.length && !filters.tiers.includes(tier)) return false
    if (filters.view === 'recommended' && !['bucket', 'super', 'large'].includes(tier)) return false
    if (filters.view === 'pitfall' && tier !== 'small') return false
    return true
  })
  const value = (restaurant: RestaurantReadModel): number | null => {
    if (filters.sort === 'distance') return campusDistance(restaurant)
    if (filters.sort === 'reviews') return restaurant.reviewCount
    if (filters.sort === 'price')
      return restaurant.price !== null && restaurant.price > 0 ? restaurant.price : null
    if (filters.sort === 'score') return restaurant.score
    return restaurant.dimensions[filters.sort]
  }
  return result.sort((left, right) => {
    const a = value(left)
    const b = value(right)
    if (a === null && b !== null) return 1
    if (a !== null && b === null) return -1
    if (a !== null && b !== null && a !== b) {
      return filters.sort === 'price' || filters.sort === 'distance' ? a - b : b - a
    }
    return left.name.localeCompare(right.name, 'zh-CN') || left.id.localeCompare(right.id)
  })
}

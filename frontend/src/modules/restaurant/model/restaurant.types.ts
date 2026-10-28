/** 页面只读模型，由餐厅API显式转换；旧快照仅用于测试与开发数据准备。 */
export interface RestaurantReadModel {
  id: string
  name: string
  category: string
  address: string
  tags: string[]
  latitude: number | null
  longitude: number | null
  needsLocation: boolean
  closed: boolean
  price: number | null
  priceKind: 'estimate' | 'exact' | 'unknown'
  score: number | null
  reviewCount: number
  recommendRate: number | null
  dimensions: Record<RatingDimension, number | null>
  source: 'USER' | 'LEGACY_IMPORT' | 'legacy-preview'
  /** 真实接口以服务端距离为准；旧快照没有此字段时才在纯逻辑测试中计算。 */
  distanceKm?: number | null
}

export type RatingDimension = 'taste' | 'value' | 'service' | 'ambience'
export type CupTier = 'bucket' | 'super' | 'large' | 'medium' | 'small' | 'none'
export type RestaurantSort = 'score' | RatingDimension | 'reviews' | 'price' | 'distance'
export type RestaurantView = 'all' | 'recommended' | 'pitfall'

/** 分类使用服务端稳定编码，所有条件随分页请求提交，不在当前页二次筛选。 */
export interface CatalogFilters {
  keyword: string
  category: string
  tiers: CupTier[]
  view: RestaurantView
  sort: RestaurantSort
  hideClosed: boolean
}

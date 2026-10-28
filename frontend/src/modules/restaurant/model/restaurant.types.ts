/** 前端只读模型，不代表尚未实现的后端接口协议；接入真实接口时需增加显式转换。 */
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
  source: 'legacy-preview'
}

export type RatingDimension = 'taste' | 'value' | 'service' | 'ambience'
export type CupTier = 'bucket' | 'super' | 'large' | 'medium' | 'small' | 'none'
export type RestaurantSort = 'score' | RatingDimension | 'reviews' | 'price' | 'distance'
export type RestaurantView = 'all' | 'recommended' | 'pitfall'

/** 筛选状态只服务当前目录浏览，不持久化个人身份或向不存在的接口发送请求。 */
export interface CatalogFilters {
  keyword: string
  category: string
  tiers: CupTier[]
  view: RestaurantView
  sort: RestaurantSort
  hideClosed: boolean
}

import type { RestaurantReadModel } from './restaurant.types'

/** 在完整候选集合内抽取；预算未知不能算作符合预算，不把停业店推荐为去吃饭的目标。 */
export function eligibleRestaurants(records: RestaurantReadModel[], budget: number | null) {
  return records.filter(r => !r.closed && (budget === null || (r.price !== null && r.price <= budget)))
}
export function pickRestaurant(records: RestaurantReadModel[], previousId?: string, random = Math.random) {
  const pool = records.length > 1 ? records.filter(r => r.id !== previousId) : records
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))] ?? null
}

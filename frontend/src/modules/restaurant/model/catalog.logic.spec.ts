import { describe, expect, it } from 'vitest'
import { campusDistance, filterRestaurants, priceLabel, tierOf } from './catalog.logic'
import { previewRestaurants } from './catalog.preview'
import type { CatalogFilters, RestaurantReadModel } from './restaurant.types'

/** 使用人工分数仅验证纯逻辑，生产预览目录始终不包含示例评分。 */
function candidate(
  id: string,
  score: number | null,
  overrides: Partial<RestaurantReadModel> = {},
): RestaurantReadModel {
  return {
    ...previewRestaurants[0]!,
    id,
    name: id,
    score,
    reviewCount: score === null ? 0 : 1,
    ...overrides,
  }
}
function filters(overrides: Partial<CatalogFilters> = {}): CatalogFilters {
  return {
    keyword: '',
    category: '',
    tiers: [],
    sort: 'score',
    view: 'all',
    hideClosed: false,
    ...overrides,
  }
}

describe('restaurant reading rules', () => {
  it.each([
    [null, 'none'],
    [0, 'small'],
    [4.999, 'small'],
    [5, 'medium'],
    [6.199, 'medium'],
    [6.2, 'large'],
    [7.399, 'large'],
    [7.4, 'super'],
    [8.55, 'super'],
    [8.599, 'super'],
    [8.6, 'bucket'],
    [10, 'bucket'],
    [NaN, 'none'],
    [-1, 'none'],
    [11, 'none'],
  ] as const)('classifies raw score %s as %s without display rounding', (score, tier) => {
    expect(tierOf(score)).toBe(tier)
  })

  it('searches across name, address, category and tags without case sensitivity', () => {
    const items = [
      candidate('a', null, {
        name: '科大面馆',
        address: '建设路',
        category: '面馆',
        tags: ['Wi-Fi'],
      }),
    ]
    for (const keyword of [' 科大 ', '建设路', '面馆', 'wi-fi']) {
      expect(filterRestaurants(items, filters({ keyword }))).toHaveLength(1)
    }
    expect(filterRestaurants(items, filters({ keyword: '找不到' }))).toEqual([])
  })

  it('keeps unrated restaurants separate from recommendations and pitfalls', () => {
    const items = [
      candidate('unrated', null),
      candidate('pitfall', 0),
      candidate('middle', 6.19),
      candidate('good', 6.2),
    ]
    expect(filterRestaurants(items, filters({ view: 'recommended' })).map((r) => r.id)).toEqual([
      'good',
    ])
    expect(filterRestaurants(items, filters({ view: 'pitfall' })).map((r) => r.id)).toEqual([
      'pitfall',
    ])
    expect(
      filterRestaurants(items, filters({ tiers: ['none', 'small'] })).map((r) => r.id),
    ).toEqual(['pitfall', 'unrated'])
  })

  it('combines category, keyword, cup tiers and closure filters', () => {
    const items = [
      candidate('a', 8, { category: '火锅', name: '建设路火锅', closed: true }),
      candidate('b', 8, { category: '火锅', name: '建设路火锅二店' }),
      candidate('c', 9, { category: '面馆' }),
    ]
    expect(
      filterRestaurants(
        items,
        filters({ category: '火锅', keyword: '建设路', tiers: ['super'], hideClosed: true }),
      ).map((r) => r.id),
    ).toEqual(['b'])
  })

  it('sorts unknown values last and uses stable IDs for identical names', () => {
    const items = [
      candidate('unknown', null, { price: null }),
      candidate('b', 8, { name: '同名', price: 20 }),
      candidate('a', 8, { name: '同名', price: 20 }),
    ]
    expect(filterRestaurants(items, filters()).map((r) => r.id)).toEqual(['a', 'b', 'unknown'])
    expect(filterRestaurants(items, filters({ sort: 'price' })).map((r) => r.id)).toEqual([
      'a',
      'b',
      'unknown',
    ])
  })

  it('sorts by a dimension or total review count independently from the overall score', () => {
    const items = [
      candidate('a', 9, {
        reviewCount: 1,
        dimensions: { taste: 5, value: null, service: null, ambience: null },
      }),
      candidate('b', 6, {
        reviewCount: 5,
        dimensions: { taste: 9, value: null, service: null, ambience: null },
      }),
    ]
    for (const sort of ['taste', 'reviews'] as const) {
      expect(filterRestaurants(items, filters({ sort })).map((r) => r.id)).toEqual(['b', 'a'])
    }
  })

  it('does not invent a distance for missing, unconfirmed or invalid coordinates', () => {
    const campus = candidate('campus', null, { latitude: 30.7544, longitude: 103.9312 })
    expect(campusDistance(campus)).toBe(0)
    expect(campusDistance({ ...campus, latitude: null })).toBeNull()
    expect(campusDistance({ ...campus, needsLocation: true })).toBeNull()
    expect(campusDistance({ ...campus, latitude: NaN })).toBeNull()
    expect(campusDistance({ ...campus, latitude: 91 })).toBeNull()
    const items = [
      candidate('far', null, { latitude: 30.65, longitude: 104.08 }),
      campus,
      candidate('unknown', null, { needsLocation: true }),
    ]
    expect(filterRestaurants(items, filters({ sort: 'distance' })).map((r) => r.id)).toEqual([
      'campus',
      'far',
      'unknown',
    ])
  })

  it('labels a legacy price estimate separately from an exact or missing price', () => {
    expect(priceLabel(candidate('a', null, { price: 25, priceKind: 'estimate' }))).toBe('约 ¥25')
    expect(priceLabel(candidate('a', null, { price: 25, priceKind: 'exact' }))).toBe('¥25')
    expect(priceLabel(candidate('a', null, { price: null, priceKind: 'unknown' }))).toBe('人均待补')
  })

  it('contains only the original 25 candidates with no synthetic reviews or ratings', () => {
    expect(previewRestaurants).toHaveLength(25)
    expect(new Set(previewRestaurants.map((restaurant) => restaurant.id)).size).toBe(25)
    for (const restaurant of previewRestaurants) {
      expect(restaurant.source).toBe('legacy-preview')
      expect(restaurant.score).toBeNull()
      expect(restaurant.reviewCount).toBe(0)
      expect(restaurant.recommendRate).toBeNull()
      expect(Object.values(restaurant.dimensions).every((value) => value === null)).toBe(true)
      expect(restaurant.tags).not.toContain('踩雷')
    }
  })
})

import { describe, expect, it } from 'vitest'
import { restaurantFixture } from '../api/restaurant.test-data'
import { eligibleRestaurants, pickRestaurant } from './random.logic'

/** 抽取只验证真实业务边界，不把一次随机结果写死为特定店。 */
describe('restaurant random selection', () => {
  const records = [
    { ...restaurantFixture, id:'1',price:15 },
    { ...restaurantFixture, id:'2',price:30 },
    { ...restaurantFixture, id:'3',price:null },
    { ...restaurantFixture, id:'4',price:10,closed:true },
  ]
  it('excludes closed shops and unknown prices under a budget', () => {
    expect(eligibleRestaurants(records,20).map(r=>r.id)).toEqual(['1'])
    expect(eligibleRestaurants(records,null).map(r=>r.id)).toEqual(['1','2','3'])
  })
  it('avoids the previous result when alternatives exist', () => {
    expect(pickRestaurant(records.slice(0,2),'1',()=>0)?.id).toBe('2')
    expect(pickRestaurant(records.slice(0,1),'1',()=>0)?.id).toBe('1')
    expect(pickRestaurant([],undefined,()=>0)).toBeNull()
  })
})

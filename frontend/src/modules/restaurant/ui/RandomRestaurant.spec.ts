import {createApp, nextTick} from 'vue'
import type {App} from 'vue'
import {createPinia,disposePinia} from 'pinia'
import {createRouter,createMemoryHistory} from 'vue-router'
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import RandomRestaurant from './RandomRestaurant.vue'
import {fetchRestaurants} from '../api/restaurantApi'
import {restaurantFixture} from '../api/restaurant.test-data'
vi.mock('../api/restaurantApi',()=>({fetchRestaurants:vi.fn()}))
/** 验证跨页查询、预算和取消边界，避免看起来能抽取却只使用当前页。 */
describe('random restaurant interaction',()=>{
 let app:App, host:HTMLDivElement, pinia:ReturnType<typeof createPinia>
 const settle=async()=>{for(let i=0;i<14;i++)await nextTick()}
 beforeEach(async()=>{
  vi.resetAllMocks();host=document.createElement('div');document.body.append(host);pinia=createPinia()
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true}})
  Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false}})
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/',component:{template:'<div />'}}]});await router.push('/')
  app=createApp(RandomRestaurant).use(pinia).use(router);app.mount(host);await settle()
 })
 afterEach(()=>{app.unmount();disposePinia(pinia);host.remove();vi.restoreAllMocks()})
 const page=(records:typeof restaurantFixture[],totalPages=1)=>({page:1,pageSize:100,total:records.length,totalPages,records})
 it('loads every page and excludes closed restaurants',async()=>{
  vi.mocked(fetchRestaurants).mockResolvedValueOnce(page([{...restaurantFixture,id:'1',closed:true}],2)).mockResolvedValueOnce(page([{...restaurantFixture,id:'2',name:'第二页唯一候选'}],2))
  host.querySelector<HTMLButtonElement>('.random-banner button')!.click();await settle()
  expect(fetchRestaurants).toHaveBeenCalledTimes(2)
  expect(vi.mocked(fetchRestaurants).mock.calls[1]![1]).toBe(2)
  expect(host.querySelector('.random-result')?.textContent).toContain('第二页唯一候选')
  expect(host.querySelector('.candidate-count')?.textContent).toContain('1 家')
 })
 it('does not silently loosen the budget or count unknown prices as matches',async()=>{
  vi.mocked(fetchRestaurants).mockResolvedValue(page([{...restaurantFixture,price:null},{...restaurantFixture,id:'2',price:50}]))
  host.querySelector<HTMLButtonElement>('.random-banner button')!.click();await settle()
  const select=host.querySelector('select')!;select.value='15';select.dispatchEvent(new Event('change'));await settle()
  expect(host.querySelector('.random-result')).toBeNull()
  expect(host.querySelector('.no-candidates')?.textContent).toContain('没有符合条件')
 })
 it('keeps failures retryable and ignores results after closing',async()=>{
  vi.mocked(fetchRestaurants).mockRejectedValueOnce(new Error('503'))
  host.querySelector<HTMLButtonElement>('.random-banner button')!.click();await settle()
  expect(host.querySelector('[role=alert]')).not.toBeNull()
  let resolve!:(value:ReturnType<typeof page>)=>void
  vi.mocked(fetchRestaurants).mockReturnValueOnce(new Promise(r=>{resolve=r}))
  host.querySelector<HTMLButtonElement>('.reroll')!.click();await settle()
  host.querySelector<HTMLButtonElement>('[aria-label="关闭随机推荐"]')!.click()
  resolve(page([restaurantFixture]));await settle()
  expect(host.querySelector('.random-result')).toBeNull()
  expect(host.querySelector('dialog')!.open).toBe(false)
 })
})

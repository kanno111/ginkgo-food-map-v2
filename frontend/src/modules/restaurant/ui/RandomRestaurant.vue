<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useRestaurantCatalog } from '../model/catalog.store'
import { fetchRestaurants } from '../api/restaurantApi'
import { eligibleRestaurants, pickRestaurant } from '../model/random.logic'
import { priceLabel } from '../model/catalog.logic'
import type { RestaurantReadModel } from '../model/restaurant.types'
const catalog = useRestaurantCatalog()
const dialog = ref<globalThis.HTMLDialogElement>(),
  loading = ref(false),
  error = ref(''),
  budget = ref<number | null>(null)
const selected = ref<RestaurantReadModel | null>(null),
  count = ref(0)
let controller: globalThis.AbortController | undefined,
  generation = 0
/** 换条件/关窗使旧请求失效；跨所有服务端页抓取后抽取，绝不只抽当前页。 */
function invalidate() {
  generation++
  controller?.abort()
  loading.value = false
  selected.value = null
  count.value = 0
  error.value = ''
}
function close() {
  invalidate()
  dialog.value?.close()
}
async function choose() {
  const previousId = selected.value?.id
  invalidate()
  const ticket = generation
  loading.value = true
  controller = new globalThis.AbortController()
  const filters = { ...catalog.filters, tiers: [...catalog.filters.tiers] }
  try {
    const all: RestaurantReadModel[] = []
    for (let page = 1; ; page++) {
      const result = await fetchRestaurants(filters, page, 100, controller.signal)
      if (ticket !== generation) return
      all.push(...result.records)
      if (page >= result.totalPages) break
    }
    const candidates = eligibleRestaurants(
      [...new Map(all.map((r) => [r.id, r])).values()],
      budget.value,
    )
    count.value = candidates.length
    selected.value = pickRestaurant(candidates, previousId)
  } catch {
    if (ticket === generation) error.value = '暂时无法获取候选餐厅，请重试。'
  } finally {
    if (ticket === generation) loading.value = false
  }
}
function open() {
  dialog.value?.showModal()
  void choose()
}
watch(() => JSON.stringify(catalog.filters), invalidate)
watch(budget, () => {
  invalidate()
  if (dialog.value?.open) void choose()
})
onUnmounted(invalidate)
</script>
<template>
  <section class="random-banner">
    <span class="dice" aria-hidden="true">⚄</span>
    <div>
      <h2>今天吃什么？</h2>
      <p>按当前条件，帮你选一家</p>
    </div>
    <button type="button" @click="open">帮我选一家 <span aria-hidden="true">→</span></button>
  </section>
  <dialog ref="dialog" class="random-dialog" aria-labelledby="random-title" @cancel.prevent="close">
    <header>
      <h2 id="random-title">⚄ 今天吃什么</h2>
      <button type="button" aria-label="关闭随机推荐" @click="close">×</button>
    </header>
    <label class="budget"
      >调整人均预算<select v-model="budget">
        <option :value="null">不限预算</option>
        <option :value="15">¥15以内</option>
        <option :value="30">¥30以内</option>
        <option :value="50">¥50以内</option>
        <option :value="100">¥100以内</option>
      </select></label
    >
    <p class="note">沿用当前搜索、分类及杯型条件，排除标注停业的店；不会自动放宽条件。</p>
    <p v-if="loading" role="status">正在从全站符合条件的餐厅中选择…</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <template v-else-if="selected">
      <p class="candidate-count">从符合条件的 {{ count }} 家店中随机选出</p>
      <div class="random-result">
        <div class="photo-placeholder" aria-label="暂无同学上传照片">
          <svg viewBox="0 0 64 64" width="52" height="52" fill="none" aria-hidden="true">
            <path
              d="M12 28h40c-2 17-9 22-20 22S14 45 12 28Zm7 27h26M25 10v10m9-12v12m9-10v10"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
            /></svg
          ><small>暂无同学上传照片</small>
        </div>
        <div>
          <h3>{{ selected.name }}</h3>
          <p>{{ selected.category }}</p>
          <strong>{{ priceLabel(selected) }}</strong>
          <p>
            {{ selected.reviewCount }} 条评价 ·
            {{ selected.score === null ? '待评级' : `${selected.score.toFixed(1)}分` }}
          </p>
        </div>
      </div>
      <p class="note">
        {{ budget === null ? '未限制人均预算。' : '人均符合所选预算，估值请以实际消费为准。'
        }}{{ selected.needsLocation ? '位置待补，请先核实地址。' : '距离以目录标注为准。' }}
      </p>
      <RouterLink class="result-link" :to="`/restaurants/${selected.id}`" @click="close"
        >查看餐厅 →</RouterLink
      >
    </template>
    <p v-else class="no-candidates">没有符合条件的餐厅。请调整预算或关闭弹层修改首页条件。</p>
    <button type="button" class="reroll" :disabled="loading" @click="choose">
      {{ error ? '重试' : '换一家' }}
    </button>
  </dialog>
</template>
<style scoped>
.random-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin: 16px 0;
  border: 1px solid #f3e3c5;
  border-radius: 12px;
  background: #fff5e2;
}
.dice {
  color: #c08b3f;
  font-size: 32px;
  line-height: 1;
}
h2 {
  margin: 0;
  font-size: 26px;
}
.random-banner h2 {
  font-size: 16px;
}
.random-banner p {
  margin: 4px 0 0;
  font-size: 11px;
  color: #958164;
}
.random-banner button {
  margin-left: auto;
  flex-shrink: 0;
  min-height: 40px;
  padding: 8px 16px;
  border: 1px solid #ebcf9f;
  border-radius: 9px;
  background: #fffdf8;
  color: #aa701c;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.random-banner button:hover {
  background: #ffedcb;
}
.random-banner button:focus-visible {
  outline: 2px solid #f59e0b;
  outline-offset: 3px;
}
.random-dialog {
  width: min(620px, calc(100% - 24px));
  max-height: 88dvh;
  overflow: auto;
  border: 1px solid #e5d7bc;
  border-radius: 24px;
  padding: 26px;
  background: #fffdf8;
  color: #2b2a26;
}
.random-dialog::backdrop {
  background: #1d1919a0;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
header button {
  border: 0;
  background: none;
  font-size: 28px;
  cursor: pointer;
}
.budget {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 24px 0;
  font-size: 14px;
}
select {
  font: inherit;
  border: 1px solid #ddd2be;
  border-radius: 12px;
  padding: 8px;
  max-width: 60%;
}
.note {
  font-size: 13px;
  color: #807058;
  line-height: 1.8;
}
.candidate-count {
  color: #8d6721;
}
.random-result {
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr);
  gap: 20px;
  align-items: center;
  margin: 24px 0;
}
h3 {
  overflow-wrap: anywhere;
}
.photo-placeholder {
  background: #f5eddb;
  border-radius: 14px;
  min-height: 130px;
  display: grid;
  place-content: center;
  text-align: center;
  font-size: 32px;
  color: #a08e6d;
}
.photo-placeholder small {
  font-size: 11px;
  display: block;
  margin-top: 12px;
}
.result-link,
.reroll {
  display: block;
  text-align: center;
  padding: 14px;
  border-radius: 12px;
  font: inherit;
  text-decoration: none;
  margin: 12px 0;
  width: 100%;
  box-sizing: border-box;
}
.result-link {
  background: #e9b949;
  color: #282a2f;
}
.reroll {
  border: 1px solid #d6b46f;
  background: white;
  cursor: pointer;
}
@media (max-width: 600px) {
  .random-banner {
    padding: 12px;
    gap: 8px;
    margin: 12px 0;
  }
  .dice {
    display: none;
  }
  .random-banner h2 {
    font-size: 15px;
  }
  .random-banner p {
    font-size: 10px;
  }
  .random-banner button {
    padding: 8px 12px;
    min-height: 44px;
    font-size: 11px;
  }
  .random-dialog {
    padding: 20px;
  }
  .random-result {
    grid-template-columns: 100px minmax(0, 1fr);
    gap: 14px;
  }
  .random-result h3 {
    font-size: 18px;
  }
  .random-result p {
    font-size: 13px;
  }
  .photo-placeholder {
    min-height: 110px;
  }
}
/* 手机以底部抽屉承接随机结果，桌面保留居中弹层。 */
@media (max-width: 600px) {
  .random-dialog {
    position: fixed;
    inset: auto 0 0;
    margin: 0;
    width: 100%;
    max-width: 100%;
    max-height: 90dvh;
    border-radius: 24px 24px 0 0;
    padding: 26px 20px calc(20px + env(safe-area-inset-bottom));
  }
  .random-dialog h2 {
    font-size: 24px;
  }
  .random-dialog header button {
    min-width: 44px;
    min-height: 44px;
  }
  .random-dialog::before {
    content: '';
    display: block;
    width: 40px;
    height: 5px;
    border-radius: 5px;
    background: #ddd;
    margin: -12px auto 18px;
  }
  .random-result svg {
    margin: auto;
  }
}
</style>

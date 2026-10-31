<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, useId } from 'vue'
import { useRestaurantCatalog } from '../model/catalog.store'

/** 高级条件独立草稿，仅确认时批量写回；不触碰分类、排序、关键词与经营状态。 */
const catalog = useRestaurantCatalog()
const prices = [20, 30, 50, 100]
const distances = [500, 1000, 2000, 3000]
const count = computed(
  () =>
    Number(catalog.filters.maxPrice !== null) + Number(catalog.filters.maxDistanceMeters !== null),
)
const draft = reactive<{ maxPrice: number | null; maxDistanceMeters: number | null }>({
  maxPrice: null,
  maxDistanceMeters: null,
})
const dialog = ref<globalThis.HTMLDialogElement>()
const trigger = ref<globalThis.HTMLButtonElement>()
const opened = ref(false)
const id = 'advanced-filters-' + useId()
let originalOverflow: string | undefined

/** 原生模态框进入浏览器顶层，避免首页clip-path裁切，并提供焦点约束及背景inert。 */
function open() {
  if (opened.value) return
  Object.assign(draft, {
    maxPrice: catalog.filters.maxPrice,
    maxDistanceMeters: catalog.filters.maxDistanceMeters,
  })
  dialog.value?.showModal()
  opened.value = true
  originalOverflow = globalThis.document.documentElement.style.overflow
  globalThis.document.documentElement.style.overflow = 'hidden'
}

/** 关闭、Escape及卸载均释放背景锁；取消时草稿丢弃，下次从已应用状态回显。 */
function cleanup() {
  opened.value = false
  if (originalOverflow !== undefined) {
    globalThis.document.documentElement.style.overflow = originalOverflow
    originalOverflow = undefined
  }
}
function close() {
  dialog.value?.close()
  cleanup()
  trigger.value?.focus({ preventScroll: true })
}
function apply() {
  Object.assign(catalog.filters, draft)
  close()
}
function reset() {
  Object.assign(draft, { maxPrice: null, maxDistanceMeters: null })
}
function backdrop(event: globalThis.MouseEvent) {
  if (event.target !== dialog.value) return
  const rect = dialog.value.getBoundingClientRect()
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    close()
}
onUnmounted(cleanup)
</script>

<template>
  <div class="advanced-filter-entry">
    <button
      ref="trigger"
      class="more-filters"
      type="button"
      :class="{ active: count > 0 }"
      :aria-expanded="opened"
      :aria-controls="id"
      aria-haspopup="dialog"
      @click="open"
    >
      更多筛选<span v-if="count" class="filter-count" :aria-label="`${count}个高级条件已生效`">{{
        count
      }}</span>
    </button>
    <Teleport to="body">
      <dialog
        :id="id"
        ref="dialog"
        class="advanced-filter-dialog"
        :aria-labelledby="id + '-title'"
        @cancel.prevent="close"
        @close="cleanup"
        @click="backdrop"
      >
        <header>
          <h2 :id="id + '-title'">更多筛选</h2>
          <button type="button" aria-label="关闭更多筛选" @click="close">关闭 ×</button>
        </header>
        <div class="advanced-filter-body">
          <fieldset>
            <legend>人均消费</legend>
            <div class="advanced-choices">
              <button
                type="button"
                :aria-pressed="draft.maxPrice === null"
                @click="draft.maxPrice = null"
              >
                不限
              </button>
              <button
                v-for="price in prices"
                :key="price"
                type="button"
                :aria-pressed="draft.maxPrice === price"
                @click="draft.maxPrice = price"
              >
                {{ price }} 元以下
              </button>
            </div>
            <p>包含所选金额；已填报金额和估值均可筛选，价格未知的餐厅将排除。</p>
          </fieldset>
          <fieldset>
            <legend>距离校区 · 直线距离</legend>
            <div class="advanced-choices">
              <button
                type="button"
                :aria-pressed="draft.maxDistanceMeters === null"
                @click="draft.maxDistanceMeters = null"
              >
                不限
              </button>
              <button
                v-for="distance in distances"
                :key="distance"
                type="button"
                :aria-pressed="draft.maxDistanceMeters === distance"
                @click="draft.maxDistanceMeters = distance"
              >
                {{ distance < 1000 ? `${distance} 米以内` : `${distance / 1000} 公里以内` }}
              </button>
            </div>
            <p>
              以清水河校区固定参考点计算直线距离，非步行距离。位置缺失或待确认的餐厅将排除，无需定位授权。
            </p>
          </fieldset>
        </div>
        <footer>
          <button class="reset-advanced" type="button" @click="reset">重置</button>
          <button class="apply-advanced" type="button" @click="apply">查看结果</button>
        </footer>
      </dialog>
    </Teleport>
  </div>
</template>

<style scoped>
.advanced-filter-entry {
  margin-left: auto;
  flex-shrink: 0;
}
button {
  font: inherit;
  cursor: pointer;
}
button:focus-visible {
  outline: 2px solid #f59e0b;
  outline-offset: 3px;
}
.more-filters {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 44px;
  padding: 9px 10px;
  border: 1px solid #e9e2d7;
  border-radius: 8px;
  background: white;
  color: #675b49;
  font-size: 13px;
  white-space: nowrap;
}
.more-filters:hover {
  border-color: #d5b78a;
}
.more-filters.active {
  background: #fff2dc;
  color: #9b6006;
  border-color: #edc78a;
}
.filter-count {
  font-size: 11px;
  font-weight: bold;
}
.advanced-filter-dialog {
  width: min(480px, calc(100vw - 24px));
  max-width: none;
  max-height: calc(100dvh - 24px);
  box-sizing: border-box;
  margin: auto;
  padding: 0;
  border: 1px solid #e9e2d7;
  border-radius: 12px;
  background: #fffdf9;
  color: #38332b;
  overflow: hidden;
}
.advanced-filter-dialog[open] {
  display: flex;
  flex-direction: column;
}
.advanced-filter-dialog::backdrop {
  background: #29221866;
}
header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 16px 20px;
  gap: 12px;
}
h2 {
  margin: 0;
  font-size: 18px;
}
header button {
  min-height: 36px;
  border: 0;
  background: transparent;
  color: #817667;
  font-size: 12px;
}
.advanced-filter-body {
  padding: 0 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 0;
}
fieldset {
  min-width: 0;
  padding: 0;
  margin: 0 0 22px;
  border: 0;
}
fieldset:last-child {
  margin-bottom: 8px;
}
legend {
  padding: 0 0 12px;
  font-size: 14px;
  font-weight: bold;
}
.advanced-choices {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.advanced-choices button {
  min-height: 44px;
  padding: 9px 13px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: #f5f3ee;
  color: #5b5246;
  font-size: 13px;
}
.advanced-choices button:hover {
  border-color: #e2cfaf;
}
.advanced-choices button[aria-pressed='true'] {
  border-color: #edbf77;
  background: #fff0d5;
  color: #9b6006;
}
p {
  margin: 10px 0 0;
  color: #817667;
  font-size: 12px;
  line-height: 1.7;
}
footer {
  border-top: 1px solid #eee8dd;
  background: white;
}
footer button {
  flex: 1;
  min-height: 44px;
  border-radius: 8px;
  border: 1px solid #e1d6c5;
  background: white;
  color: #675b49;
}
footer .apply-advanced {
  flex: 1.4;
  border-color: #f59e0b;
  background: #f59e0b;
  color: #382800;
  font-weight: bold;
}
@media (max-width: 640px) {
  .more-filters {
    font-size: 12px;
    padding: 9px 5px;
    gap: 3px;
  }
  header,
  footer {
    padding: 12px 16px;
  }
  .advanced-filter-body {
    padding: 0 16px;
  }
}
</style>

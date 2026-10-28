<script setup lang="ts">
import axios from 'axios'
import { computed, onUnmounted, ref, watch } from 'vue'
import { toErrorMessage } from '@/shared/lib/toErrorMessage'
import { fetchRestaurant } from '../api/restaurantApi'
import type { RestaurantReadModel } from '../model/restaurant.types'
import { campusDistance, priceLabel, ratingDimensions, tierOf } from '../model/catalog.logic'
import CupBadge from './CupBadge.vue'
import RestaurantManagementActions from './RestaurantManagementActions.vue'

const props = defineProps<{ id: string }>()
const restaurant = ref<RestaurantReadModel | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
let controller: globalThis.AbortController | undefined
let generation = 0
const demo = computed(() => restaurant.value?.tags.includes('联调模拟') ?? false)
const distance = computed(() => (restaurant.value ? campusDistance(restaurant.value) : null))
const copyFeedback = ref<string | null>(null)
const manualCopyText = ref('')

/** 路由复用和失败重试都独立读取；取消旧请求，避免旧店资料覆盖新页面。 */
async function loadDetail(): Promise<void> {
  const requestGeneration = ++generation
  controller?.abort()
  controller = new globalThis.AbortController()
  const signal = controller.signal
  restaurant.value = null
  loading.value = true
  error.value = null
  copyFeedback.value = null
  manualCopyText.value = ''
  try {
    const result = await fetchRestaurant(props.id, signal)
    if (requestGeneration === generation) restaurant.value = result
  } catch (reason) {
    if (requestGeneration !== generation || signal.aborted) return
    // 只有真实404才展示“没有找到”，临时断网和服务故障必须允许重试。
    if (!axios.isAxiosError(reason) || reason.response?.status !== 404) {
      error.value = toErrorMessage(reason)
    }
  } finally {
    if (requestGeneration === generation) loading.value = false
  }
}
watch(
  () => props.id,
  () => {
    void loadDetail()
  },
  { immediate: true },
)
onUnmounted(() => {
  generation += 1
  controller?.abort()
})

/** 剪贴板权限或HTTP环境受限时提供可选中文本，不把未复制的操作宣告为成功。 */
async function copyText(text: string): Promise<void> {
  const requestedId = props.id
  copyFeedback.value = null
  manualCopyText.value = ''
  try {
    if (!globalThis.navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
    await globalThis.navigator.clipboard.writeText(text)
    if (props.id !== requestedId) return
    copyFeedback.value = '已复制，可以分享给同学了。'
  } catch {
    if (props.id !== requestedId) return
    manualCopyText.value = text
    copyFeedback.value = '暂时无法自动复制，请选中下方文字手动复制。'
  }
}

/** 分享仅包含当前餐厅页面，不拼接浏览器存储中的登录凭证。 */
function shareRestaurant(): void {
  if (!restaurant.value) return
  const link = new globalThis.URL(
    `/restaurants/${encodeURIComponent(restaurant.value.id)}`,
    globalThis.location.origin,
  )
  void copyText(
    `${restaurant.value.name}\n${restaurant.value.address}\n${link.href}\n${demo.value ? '联调模拟数据，仅供测试。' : '营业与消费信息请出发前核实。'}`,
  )
}
</script>

<template>
  <section v-if="loading" class="missing-restaurant" role="status">正在加载餐厅资料…</section>
  <section v-else-if="error" class="missing-restaurant" role="alert">
    <h1>餐厅资料暂时无法加载。</h1>
    <p>{{ error }}</p>
    <button type="button" class="primary-action" @click="loadDetail">重新加载</button>
    <RouterLink to="/">返回餐厅目录</RouterLink>
  </section>
  <article v-else-if="restaurant" class="restaurant-detail" aria-labelledby="restaurant-title">
    <div class="detail-breadcrumb">
      <RouterLink to="/">← 返回餐厅目录</RouterLink
      ><span>餐厅目录 / {{ restaurant.category }}</span>
    </div>
    <p class="detail-preview" role="note">
      {{
        demo
          ? '联调模拟 · 此店仅供测试，不代表真实经营情况。'
          : restaurant.source === 'LEGACY_IMPORT'
            ? '历史导入 · 原版候选信息尚未核实。'
            : '用户提供的餐厅资料。'
      }}
      营业、地址及消费请出发前核实。
    </p>
    <section class="detail-heading">
      <div>
        <p class="eyebrow">A PLACE TO DISCOVER</p>
        <h1 id="restaurant-title">{{ restaurant.name }}</h1>
        <p class="detail-subtitle">
          {{ restaurant.category }}<span>·</span>{{ priceLabel(restaurant) }} / 人 <span>·</span
          >{{ distance === null ? '位置待补充' : `距清水河校区 ${distance.toFixed(1)} km` }}
        </p>
        <p v-if="restaurant.closed" class="closed-note">此店标注为已停业，当前状态请出发前核实。</p>
        <p v-if="restaurant.priceKind === 'estimate'" class="price-note">
          人均仅为估值，请以实际消费为准。
        </p>
      </div>
      <div class="detail-cup">
        <CupBadge :tier="tierOf(restaurant.score)" /><small>等待真实的第一口</small>
      </div>
    </section>
    <RestaurantManagementActions :id="restaurant.id" :key="restaurant.id" />
    <div class="detail-layout">
      <div class="detail-main">
        <section class="detail-panel" aria-labelledby="score-title">
          <div class="panel-heading">
            <h2 id="score-title">把感受，分成四份。</h2>
            <RouterLink to="/scoring-guide">评分说明 ↗</RouterLink>
          </div>
          <dl class="score-summary">
            <div>
              <dt>综合评分</dt>
              <dd>{{ restaurant.score?.toFixed(1) ?? '—' }}</dd>
            </div>
            <div>
              <dt>推荐率</dt>
              <dd>
                {{
                  restaurant.recommendRate === null
                    ? '—'
                    : `${Math.round(restaurant.recommendRate * 100)}%`
                }}
              </dd>
            </div>
            <div>
              <dt>真实评价</dt>
              <dd>{{ restaurant.reviewCount }}<small> 条</small></dd>
            </div>
          </dl>
          <dl class="dimension-list">
            <div v-for="dimension in ratingDimensions" :key="dimension.key">
              <dt>{{ dimension.label }}</dt>
              <dd>{{ restaurant.dimensions[dimension.key]?.toFixed(1) ?? '暂无评分' }}</dd>
            </div>
          </dl>
          <p class="panel-note">没有评价的店显示“待评级”，不等于低分。杯型会根据真实评价计算。</p>
        </section>
        <section class="detail-panel review-placeholder" aria-labelledby="reviews-title">
          <div class="panel-heading">
            <h2 id="reviews-title">吃过的人，怎么说。</h2>
            <span>{{ restaurant.reviewCount }} 条评价</span>
          </div>
          <div class="review-empty">
            <CupBadge tier="none" />
            <h3>好味道，等真实的故事。</h3>
            <p>暂不支持发布评价或上传照片。</p>
            <RouterLink to="/scoring-guide">先了解如何认真评价 →</RouterLink>
          </div>
        </section>
      </div>
      <aside class="detail-aside" aria-label="餐厅基本信息">
        <section class="address-panel">
          <p class="eyebrow">FIND THIS PLACE</p>
          <h2>这家店在哪里</h2>
          <p class="restaurant-address">{{ restaurant.address || '地址待补充' }}</p>
          <p class="distance-note">
            {{
              distance === null
                ? '位置尚未确认'
                : `距清水河校区约 ${distance.toFixed(1)} km，直线距离`
            }}
          </p>
          <button type="button" @click="copyText(restaurant.address || restaurant.name)">
            复制地址 ↗
          </button>
          <p class="map-note">地图与路线功能将后续开放，请出发前核实地址。</p>
        </section>
        <section class="tag-panel">
          <h2>关于这家店</h2>
          <div class="detail-tags">
            <span v-for="tag in restaurant.tags" :key="tag">{{ tag }}</span>
          </div>
          <p>
            {{
              demo
                ? '带“联调模拟”标签的资料仅供测试。'
                : restaurant.source === 'LEGACY_IMPORT'
                  ? '标签来自历史导入资料，仅供参考。'
                  : '标签由餐厅资料提供者填写。'
            }}
          </p>
        </section>
        <button class="share-button" type="button" @click="shareRestaurant">分享这家店 ↗</button>
        <p v-if="copyFeedback" class="copy-feedback" role="status">{{ copyFeedback }}</p>
        <label v-if="manualCopyText" class="manual-copy"
          >待复制的内容<textarea
            :value="manualCopyText"
            readonly
            rows="5"
            @focus="($event.target as HTMLTextAreaElement).select()"
          />
        </label>
      </aside>
    </div>
  </article>
  <section v-else class="missing-restaurant" aria-labelledby="missing-title">
    <CupBadge tier="none" />
    <h1 id="missing-title">没有找到这家店。</h1>
    <p>餐厅可能已删除或链接有误，回去看看其他好味道吧。</p>
    <RouterLink class="primary-action" to="/">返回餐厅目录</RouterLink>
  </section>
</template>

<style scoped>
.restaurant-detail {
  width: min(1100px, calc(100% - 40px));
  margin: 0 auto;
  padding: 30px 0 80px;
}
.detail-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: #77674f;
}
.detail-breadcrumb a {
  text-decoration: none;
  color: #786746;
}
.detail-preview {
  padding: 13px 17px;
  border: 1px solid #e6d8b5;
  border-radius: 10px;
  background: #f6efdd;
  font-size: 12px;
  line-height: 1.8;
  color: #8b7142;
  margin: 24px 0 0;
}
.detail-heading {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: center;
  margin: 40px 0;
}
h1 {
  margin: 15px 0;
  font-family: Georgia, 'Songti SC', serif;
  font-size: clamp(30px, 4.6vw, 48px);
  line-height: 1.4;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.detail-subtitle {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: #80735d;
  font-size: 12px;
}
.price-note,
.closed-note {
  font-size: 12px;
  color: #79664c;
  line-height: 1.8;
}
.closed-note {
  color: #975543;
}
.detail-cup {
  display: grid;
  justify-items: center;
  flex: 0 0 auto;
  gap: 10px;
  padding: 20px;
  border: 1px solid #ded7c7;
  border-radius: 16px;
}
.detail-cup :deep(.cup-badge) {
  flex-direction: column;
}
.detail-cup small {
  color: #79674f;
  font-size: 12px;
}
.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  align-items: start;
  gap: 26px;
}
.detail-main {
  min-width: 0;
  display: grid;
  gap: 22px;
}
.detail-panel {
  padding: 28px;
  border: 1px solid #e2d9c9;
  border-radius: 18px;
  background: #fffdf8;
}
.panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}
.panel-heading a,
.panel-heading > span {
  font-size: 12px;
  color: #8e7e60;
  text-decoration: none;
  white-space: nowrap;
}
.score-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  padding: 24px 0;
  margin: 16px 0 20px;
  border-bottom: 1px solid #eee6d8;
}
dt {
  color: #75654d;
  font-size: 12px;
}
dd {
  margin: 12px 0 0;
  color: #686c53;
  font-family: Georgia, serif;
  font-size: 32px;
}
dd small {
  font-size: 12px;
  font-family: sans-serif;
}
.dimension-list {
  display: grid;
  gap: 16px;
  margin: 0;
}
.dimension-list > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.dimension-list dd {
  margin: 0;
  font-family: inherit;
  color: #7c6d55;
  font-size: 12px;
}
.panel-note {
  margin: 24px 0 0;
  padding-top: 20px;
  border-top: 1px dashed #e7ddcb;
  color: #7c694d;
  font-size: 12px;
  line-height: 1.8;
}
.review-empty {
  padding: 42px 10px 28px;
  text-align: center;
}
h3 {
  margin: 20px 0 10px;
  font-family: Georgia, 'Songti SC', serif;
  font-size: 24px;
  font-weight: 500;
}
.review-empty p {
  color: #7a684e;
  font-size: 12px;
  line-height: 1.8;
}
.review-empty a {
  display: inline-block;
  margin-top: 14px;
  color: #8d723f;
  text-decoration: none;
  font-size: 12px;
}
.detail-aside {
  min-width: 0;
}
.address-panel {
  padding: 24px;
  border: 1px solid #d9dbc9;
  border-radius: 18px;
  background: #eaecdf;
}
.address-panel .eyebrow {
  color: #7c805f;
  font-size: 12px;
}
.address-panel h2 {
  margin-top: 14px;
}
.restaurant-address {
  margin: 22px 0 14px;
  color: #5e674d;
  line-height: 1.9;
  font-size: 14px;
}
.distance-note,
.map-note {
  color: #697255;
  font-size: 12px;
  line-height: 1.8;
}
.address-panel button {
  padding: 10px 14px;
  border: 1px solid #c1c9ad;
  border-radius: 8px;
  background: transparent;
  color: #636f4b;
  font-size: 12px;
  cursor: pointer;
}
.map-note {
  margin: 24px 0 0;
  padding-top: 16px;
  border-top: 1px solid #d2d7c1;
}
.tag-panel {
  margin: 28px 0;
}
.tag-panel h2 {
  font-size: 13px;
}
.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 16px;
}
.detail-tags span {
  padding: 6px 9px;
  border: 1px solid #e1d8c6;
  border-radius: 7px;
  color: #8e7c5c;
  font-size: 12px;
}
.tag-panel p {
  color: #7b694b;
  font-size: 12px;
  line-height: 1.8;
}
.share-button {
  width: 100%;
  padding: 13px;
  border: 1px solid #d9cfbb;
  border-radius: 10px;
  background: transparent;
  color: #84704b;
  font-size: 12px;
  cursor: pointer;
}
.copy-feedback,
.manual-copy {
  color: #7c715c;
  font-size: 12px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.manual-copy textarea {
  width: 100%;
  margin-top: 8px;
  padding: 10px;
  border: 1px solid #d9cfbb;
  border-radius: 8px;
  background: #fffdf8;
  font: inherit;
}
.missing-restaurant {
  width: min(650px, calc(100% - 40px));
  margin: 80px auto;
  text-align: center;
}
.missing-restaurant p {
  color: #8d7d62;
  font-size: 14px;
  line-height: 1.8;
  margin-bottom: 24px;
}
@media (max-width: 750px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }
  .detail-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .detail-cup {
    display: flex;
    width: 100%;
    justify-content: space-between;
  }
  .detail-cup :deep(.cup-badge) {
    flex-direction: row;
  }
  .detail-panel {
    padding: 22px;
  }
  .restaurant-detail {
    width: calc(100% - 28px);
  }
}
</style>

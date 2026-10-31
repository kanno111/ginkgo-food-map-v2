<script setup lang="ts">
import axios from 'axios'
import { ReviewComposer, ReviewPanel, ScoreRadar } from '@/modules/review'
import { computed, onUnmounted, ref, watch } from 'vue'
import { toErrorMessage } from '@/shared/lib/toErrorMessage'
import { fetchRestaurant } from '../api/restaurantApi'
import type { RestaurantReadModel } from '../model/restaurant.types'
import { campusDistance, priceLabel } from '../model/catalog.logic'
import RestaurantManagementActions from './RestaurantManagementActions.vue'
import { useRestaurantCatalog } from '../model/catalog.store'

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
// 回执确认后分别刷新点评和统计，保留整个详情组件与讨论面板。
const reviewRevision = ref(0)
const catalog = useRestaurantCatalog()
const statisticsLoading = ref(false),
  statisticsError = ref('')
let statisticsController: globalThis.AbortController | undefined,
  statisticsGeneration = 0

/** 统计失败独立重试，不重新发布点评；同店组件保留，切店后拒绝晚到的旧统计。 */
async function refreshStatistics(): Promise<void> {
  const id = props.id,
    ticket = ++statisticsGeneration
  statisticsController?.abort()
  statisticsController = new globalThis.AbortController()
  const signal = statisticsController.signal
  statisticsLoading.value = true
  statisticsError.value = ''
  try {
    const fresh = await fetchRestaurant(id, signal)
    if (ticket === statisticsGeneration && props.id === id) restaurant.value = fresh
  } catch (reason) {
    if (ticket !== statisticsGeneration || signal.aborted || props.id !== id) return
    if (axios.isAxiosError(reason) && reason.response?.status === 404) {
      void loadDetail()
      return
    }
    statisticsError.value = '评分刷新失败，当前显示上次读取的数据。请重试刷新。'
  } finally {
    if (ticket === statisticsGeneration) statisticsLoading.value = false
  }
}
function published() {
  reviewRevision.value++
  catalog.invalidate()
  void refreshStatistics()
}

/** 路由复用和失败重试都独立读取；取消旧请求，避免旧店资料覆盖新页面。 */
async function loadDetail(): Promise<void> {
  statisticsGeneration++
  statisticsController?.abort()
  statisticsLoading.value = false
  statisticsError.value = ''
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
  statisticsGeneration++
  statisticsController?.abort()
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
    </section>
    <p class="detail-location">
      ⌖ {{ restaurant.address || '地址待补充'
      }}<span>
        {{
          distance === null ? '位置尚未确认' : '距清水河校区约 ' + distance.toFixed(1) + ' km'
        }}</span
      >
    </p>
    <RestaurantManagementActions :id="restaurant.id" :key="restaurant.id" />
    <div class="detail-actions">
      <button type="button" @click="copyText(restaurant.address || restaurant.name)">
        复制地址</button
      ><ReviewComposer :restaurant="restaurant" @published="published" />
    </div>
    <div class="detail-layout">
      <div class="detail-main">
        <section class="detail-panel" aria-labelledby="score-title">
          <div class="panel-heading">
            <h2 id="score-title">四维评分</h2>
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
              <dt>评分人数</dt>
              <dd>
                {{ restaurant.participantCount
                }}<small> 人 · {{ restaurant.reviewCount }} 条点评</small>
              </dd>
            </div>
          </dl>
          <ScoreRadar :dimensions="restaurant.dimensions" />
          <p v-if="statisticsLoading" class="panel-note" role="status">正在更新评分…</p>
          <p v-if="statisticsError" class="panel-note" role="alert">
            {{ statisticsError }} <button type="button" @click="refreshStatistics">重试刷新</button>
          </p>
          <p class="panel-note">
            每位同学只取最新有效点评，历史点评保留但不重复计分。{{
              restaurant.participantCount === 0
                ? '暂无评分，欢迎分享你的体验。'
                : '请结合评分人数和具体点评判断。'
            }}
          </p>
        </section>
        <ReviewPanel
          :key="restaurant.id"
          :restaurant-id="restaurant.id"
          :revision="reviewRevision"
          @changed="refreshStatistics"
        />
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
    <h1 id="missing-title">没有找到这家店。</h1>
    <p>餐厅可能已删除或链接有误，回去看看其他好味道吧。</p>
    <RouterLink class="primary-action" to="/">返回餐厅目录</RouterLink>
  </section>
</template>

<style scoped>
/* 详情不设封面，照片归属点评；底栏预留安全区域。 */
.restaurant-detail {
  width: min(1100px, calc(100% - 40px));
  margin: auto;
  padding: 22px 0 32px;
}
.detail-breadcrumb {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: #7e7566;
}
a {
  text-decoration: none;
}
.detail-preview {
  margin: 16px 0;
  padding: 10px 14px;
  border-radius: 10px;
  background: #fff6e3;
  font-size: 11px;
  line-height: 1.8;
  color: #95733c;
}
.detail-heading {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 12px;
  margin: 20px 0 12px;
}
.detail-heading > div:first-child {
  flex: 1;
  min-width: 0;
}
h1 {
  font-size: 32px;
  margin: 0 0 12px;
  overflow-wrap: anywhere;
}
.eyebrow {
  display: none;
}
.detail-subtitle {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
  color: #77766f;
  line-height: 1.8;
}
.price-note,
.closed-note {
  font-size: 12px;
  color: #9c762f;
  line-height: 1.8;
}
.detail-location {
  padding: 12px 14px;
  background: #f8f9fb;
  border: 1px solid #eceef2;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.detail-location span {
  color: #979797;
  font-size: 11px;
}
.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 270px;
  gap: 24px;
  margin-top: 20px;
  align-items: start;
}
.detail-main,
.detail-aside {
  min-width: 0;
}
.detail-main {
  display: grid;
  gap: 20px;
}
.detail-panel,
.address-panel {
  padding: 22px;
  background: white;
  border: 1px solid #ece9e3;
  border-radius: 16px;
}
.panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
h2 {
  margin: 0;
  font-size: 18px;
}
.panel-heading a {
  font-size: 12px;
  color: #9c865e;
}
.score-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 16px 0 22px;
  padding: 16px;
  border-radius: 12px;
  background: #fff8eb;
}
dt {
  font-size: 12px;
  color: #7f7e7a;
}
dd {
  margin: 12px 0 0;
  font-size: 30px;
  font-weight: 700;
}
.score-summary > div:first-child dd {
  color: #ef9205;
}
dd small {
  font-size: 12px;
  font-weight: 400;
}
.panel-note,
.restaurant-address,
.distance-note,
.map-note,
.tag-panel p,
.copy-feedback,
.manual-copy {
  font-size: 12px;
  line-height: 1.8;
  color: #8b806b;
  overflow-wrap: anywhere;
}
.panel-note {
  margin: 18px 0 0;
}
.address-panel h2 {
  font-size: 16px;
}
.address-panel button,
.share-button {
  min-height: 44px;
  border: 1px solid #dfd5c1;
  border-radius: 10px;
  padding: 10px 16px;
  background: white;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.tag-panel {
  margin: 22px 0;
}
.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 14px;
}
.detail-tags span {
  padding: 5px 10px;
  border-radius: 20px;
  background: #fff5df;
  font-size: 12px;
}
.share-button {
  width: 100%;
}
.manual-copy textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #dfd5c1;
  border-radius: 10px;
  font: inherit;
}
.detail-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid #ece9e3;
  background: #fffffff5;
  backdrop-filter: blur(12px);
}
.detail-actions > button {
  min-height: 46px;
  border: 1px solid #f2ad2c;
  border-radius: 12px;
  padding: 10px 24px;
  background: white;
  font: inherit;
  color: #b58027;
  cursor: pointer;
}
.detail-actions :deep(.review-open) {
  background: #f6a00b;
  color: white;
  padding: 12px 52px;
  border-radius: 12px;
}
.missing-restaurant {
  width: min(650px, calc(100% - 32px));
  margin: 70px auto;
  text-align: center;
}
.missing-restaurant p {
  line-height: 1.8;
}
@media (max-width: 750px) {
  .restaurant-detail {
    width: calc(100% - 24px);
    padding-top: 16px;
  }
  h1 {
    font-size: 24px;
  }
  .detail-layout {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .detail-main,
  .detail-aside {
    width: 100%;
  }
  .detail-panel {
    padding: 16px;
  }
  .detail-actions > button {
    flex: 1;
    padding: 10px;
  }
  .detail-actions :deep(.review-open) {
    flex: 2;
    padding: 12px 24px;
  }
  .score-summary {
    padding: 14px 10px;
  }
  dd {
    font-size: 26px;
  }
  .address-panel,
  .tag-panel {
    display: none;
  }
}
</style>

<script setup lang="ts">
import { computed, inject, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLoginStore } from '@/modules/auth/model/login.store'
import { authToken } from '@/shared/api/authSession'
import { fetchRestaurants } from '@/modules/restaurant/api/restaurantApi'
import type { RestaurantReadModel } from '@/modules/restaurant/model/restaurant.types'
import { ratingDimensions, tierOf } from '@/modules/restaurant/model/catalog.logic'
import CupBadge from '@/modules/restaurant/ui/CupBadge.vue'
import { overall, validBody, reviewGatewayKey, unavailableReviewGateway } from '../model/review'
import { compressPhoto } from '../model/photos'
const props = defineProps<{ restaurant?: RestaurantReadModel }>()
const emit = defineEmits<{ published: [] }>()
const auth = useLoginStore(),
  route = useRoute(),
  router = useRouter()
const gateway = inject(reviewGatewayKey, unavailableReviewGateway)
const dialog = ref<globalThis.HTMLDialogElement>(),
  opened = ref(false),
  loading = ref(false),
  busy = ref(false),
  processing = ref(false),
  error = ref('')
const restaurants = ref<RestaurantReadModel[]>([]),
  selected = ref(''),
  body = ref(''),
  recommended = ref(true)
const scores = ref({ taste: 7, value: 7, service: 7, ambience: 7 })
const photos = ref<{ file: globalThis.File; url: string }[]>([])
let requestId = '',
  submittedContent = '',
  owner: string | null = null,
  generation = 0,
  controller: globalThis.AbortController | undefined
const total = computed(() => overall(scores.value))
const current = computed(() => restaurants.value.find((r) => r.id === selected.value))
const predicted = computed(() => {
  const r = current.value
  if (!r) return total.value
  if (r.reviewCount && r.score === null) return null
  return ((r.score ?? 0) * r.reviewCount + total.value) / (r.reviewCount + 1)
})
/** 原生dialog提供焦点圈定和Escape；关闭后释放草稿图片URL，旧异步请求不得回填。 */
function close() {
  generation++
  controller?.abort()
  opened.value = false
  dialog.value?.close?.()
  photos.value.forEach((p) => globalThis.URL.revokeObjectURL(p.url))
  photos.value = []
}
async function open() {
  if (opened.value) return
  if (!auth.authenticated) {
    await router.push({
      path: '/login',
      query: {
        redirect: props.restaurant
          ? `/restaurants/${props.restaurant.id}?writeReview=1`
          : '/?writeReview=1',
      },
    })
    return
  }
  owner = authToken.value
  requestId = globalThis.crypto.randomUUID()
  submittedContent = ''
  body.value = ''
  scores.value = { taste: 7, value: 7, service: 7, ambience: 7 }
  recommended.value = true
  error.value = ''
  opened.value = true
  await nextTick()
  if (dialog.value?.showModal) dialog.value.showModal()
  else if (dialog.value) dialog.value.open = true
  loading.value = true
  const ticket = ++generation
  controller = new globalThis.AbortController()
  restaurants.value = props.restaurant ? [props.restaurant] : []
  selected.value = props.restaurant?.id ?? ''
  try {
    const all: RestaurantReadModel[] = []
    for (let page = 1; ; page++) {
      const result = await fetchRestaurants(
        { keyword: '', category: '', tiers: [], view: 'all', sort: 'score', hideClosed: false },
        page,
        100,
        controller.signal,
      )
      all.push(...result.records)
      if (page >= result.totalPages) break
    }
    if (ticket !== generation) return
    restaurants.value = all
    selected.value = props.restaurant?.id ?? all[0]?.id ?? ''
  } catch {
    if (ticket === generation) error.value = '餐厅列表加载失败，请关闭后重试。'
  } finally {
    if (ticket === generation) loading.value = false
  }
}
/** 图片按顺序处理；过量明确提示，不静默丢图。账号切换或关窗后丢弃解码结果。 */
async function addPhotos(files: globalThis.FileList | null) {
  if (!files || processing.value) return
  error.value = ''
  if (photos.value.length + files.length > 2) {
    error.value = '最多添加2张照片，请先移除多余照片。'
    return
  }
  processing.value = true
  const ticket = generation
  try {
    for (const file of Array.from(files)) {
      const compressed = await compressPhoto(file)
      if (ticket !== generation) return
      photos.value.push({ file: compressed, url: globalThis.URL.createObjectURL(compressed) })
    }
  } catch (reason) {
    if (ticket === generation)
      error.value = reason instanceof Error ? reason.message : '图片处理失败，请重试。'
  } finally {
    processing.value = false
  }
}
function removePhoto(index: number) {
  const p = photos.value.splice(index, 1)[0]
  if (p) globalThis.URL.revokeObjectURL(p.url)
}
async function submit() {
  if (busy.value || processing.value) return
  if (owner !== authToken.value || !auth.authenticated) {
    error.value = '登录身份已变化，请关闭后重新打开。'
    return
  }
  if (!selected.value || !validBody(body.value, 5, 500)) {
    error.value = '请选择餐厅，并填写5–500字的评价。'
    return
  }
  busy.value = true
  error.value = ''
  const ticket = generation
  // 相同内容重试复用请求号；改动正文、评分或图片后是新请求，避免后端幂等内容冲突。
  const content = JSON.stringify([
    selected.value,
    scores.value,
    recommended.value,
    body.value.trim(),
    photos.value.map((p) => p.url),
  ])
  if (submittedContent && submittedContent !== content) requestId = globalThis.crypto.randomUUID()
  submittedContent = content
  try {
    await gateway.publish({
      restaurantId: selected.value,
      scores: { ...scores.value },
      recommended: recommended.value,
      body: body.value.trim(),
      photos: photos.value.map((p) => p.file),
      clientRequestId: requestId,
    })
    if (ticket === generation && owner === authToken.value) {
      close()
      emit('published')
    }
  } catch (reason) {
    if (ticket === generation)
      error.value = reason instanceof Error ? reason.message : '发布失败，草稿已保留。'
  } finally {
    busy.value = false
  }
}
watch(
  authToken,
  () => {
    if (opened.value) close()
  },
  { flush: 'sync' },
)
watch(
  () => [route.query.writeReview, auth.authenticated],
  () => {
    if (route.query.writeReview === '1' && auth.authenticated) {
      void open()
      // 回跳意图只消费一次，避免发布刷新详情后再次弹出空表单。
      const query = { ...route.query }
      delete query.writeReview
      void router.replace({ path: route.path, query, hash: route.hash })
    }
  },
  { immediate: true },
)
onUnmounted(close)
</script>
<template>
  <button type="button" class="review-open" @click="open">写评价</button>
  <dialog ref="dialog" class="review-dialog" @cancel.prevent="close">
    <form @submit.prevent="submit">
      <header>
        <h2>写一条评价</h2>
        <button type="button" aria-label="关闭评价" @click="close">×</button>
      </header>
      <div class="review-fields">
        <label
          >评价哪家店<select v-model="selected" :disabled="loading">
            <option value="">{{ loading ? '正在加载餐厅…' : '请选择餐厅' }}</option>
            <option v-for="r in restaurants" :key="r.id" :value="r.id">
              {{ r.name }}{{ r.closed ? '（已停业）' : '' }}
            </option>
          </select></label
        >
        <RouterLink class="add-missing" to="/restaurants/new" @click="close">找不到要评价的店？添加餐厅 →</RouterLink>
        <div class="preview-strip">
          <span
            >本条总分 <b>{{ total.toFixed(1) }}</b></span
          ><span>这家店现在</span><CupBadge :tier="tierOf(current?.score ?? null)" /><span
            >→ 加上这条</span
          ><CupBadge :tier="tierOf(predicted)" /><span
            >预测综合分 <b>{{ predicted?.toFixed(1) ?? '—' }}</b></span
          >
        </div>
        <div v-for="d in ratingDimensions" :key="d.key" class="slider-row">
          <label :for="'review-' + d.key">{{ d.label }}</label
          ><input
            :id="'review-' + d.key"
            v-model.number="scores[d.key]"
            type="range"
            min="0"
            max="10"
            step="0.5"
          /><output>{{ scores[d.key].toFixed(1) }}</output>
        </div>
        <p class="hint">
          四项都是0–10分，步进0.5；拖动后实时预测杯型。本条总分 {{ total.toFixed(2) }}
        </p>
        <fieldset>
          <legend>你的判断</legend>
          <button type="button" :aria-pressed="recommended" @click="recommended = true">推荐</button
          ><button type="button" :aria-pressed="!recommended" @click="recommended = false">
            不推荐
          </button>
        </fieldset>
        <p class="hint">发布账号：{{ auth.user?.username }}</p>
        <label
          >写点什么
          <textarea
            v-model="body"
            rows="4"
            placeholder="比如：二楼阿姨手不抖，八块钱两荤一素，赶早八前来一份刚好。"
          />
        </label>
        <p class="hint">{{ Array.from(body.trim()).length }} / 500 · 至少5个字</p>
        <label
          class="dropzone"
          @dragover.prevent
          @drop.prevent="addPhotos($event.dataTransfer?.files ?? null)"
          >照片（最多2张，自动压缩）<span>把图片拖到这里，或点击选择</span
          ><input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            :disabled="processing"
            @change="
              addPhotos(($event.target as HTMLInputElement).files)
              ;($event.target as HTMLInputElement).value = ''
            "
        /></label>
        <p class="hint">
          {{
            processing
              ? '正在压缩图片…'
              : '最长边1200px，每张不超过300KB。照片当前仅保存在本次草稿中。'
          }}
        </p>
        <div class="thumbs">
          <div v-for="(photo, i) in photos" :key="photo.url">
            <img :src="photo.url" alt="待发布照片" /><button
              type="button"
              aria-label="移除照片"
              @click="removePhoto(i)"
            >
              ×
            </button>
          </div>
        </div>
        <p v-if="error" role="alert" class="error">{{ error }}</p>
      </div>
      <footer>
        <span class="hint">认真评价，对下一位同学负责。</span
        ><button type="button" @click="close">取消</button
        ><button class="publish" :disabled="busy || processing || loading" type="submit">
          {{ busy ? '发布中…' : '提交评价' }}
        </button>
      </footer>
    </form>
  </dialog>
</template>
<style scoped>
.review-open,
.publish {
  background: #2c2923;
  color: #fff;
  border: 0;
  border-radius: 8px;
  padding: 11px 19px;
  cursor: pointer;
}
.review-dialog {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  width: min(680px, calc(100% - 24px));
  max-height: min(88dvh, 900px);
  padding: 0;
  border: 1px solid #d9cfbb;
  border-radius: 16px;
  background: #ffffff;
  color: #342e25;
}
.review-dialog::backdrop {
  background: #24201899;
}
.review-dialog form {
  display: flex;
  flex-direction: column;
  max-height: 88dvh;
}
.review-fields {
  overflow: auto;
  min-height: 0;
  padding: 16px 18px;
}
header,
footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  background: #fffdf7;
  flex-shrink: 0;
}
header {
  justify-content: space-between;
  border-bottom: 1px solid #e8decd;
}
h2 {
  font-size: 16px;
  margin: 0;
}
button {
  font: inherit;
  cursor: pointer;
}
header button {
  border: 0;
  background: none;
  font-size: 25px;
}
label {
  display: block;
  font-size: 12.5px;
  font-weight: 700;
}
select,
textarea {
  width: 100%;
  margin: 8px 0 14px;
  padding: 11px 12px;
  border: 1px solid #d8ccb7;
  background: #fdfbf7;
  border-radius: 10px;
  font: inherit;
  font-weight: 400;
  box-sizing: border-box;
}
textarea {
  resize: vertical;
  min-height: 110px;
}
.preview-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #fcf9f2;
  border: 1px dashed #e0cba6;
  border-radius: 12px;
  margin-bottom: 20px;
  font-size: 12px;
}
.slider-row {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr) 32px;
  align-items: center;
  gap: 12px;
  margin: 15px 0;
}
input[type='range'] {
  appearance: none;
  width: 100%;
  height: 22px;
  background: transparent;
}
input[type='range']::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 999px;
  background: #ece5d6;
}
input[type='range']::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  margin-top: -6px;
  border-radius: 50%;
  background: #e9b949;
  border: 2px solid white;
  box-shadow: 0 1px 5px #2b2a2647;
  cursor: pointer;
}
input[type='range']::-moz-range-track {
  height: 6px;
  border-radius: 999px;
  background: #ece5d6;
}
input[type='range']::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #e9b949;
  border: 2px solid white;
}
.hint {
  font-size: 12px;
  color: #80735d;
  line-height: 1.7;
}
fieldset {
  border: 0;
  padding: 0;
  margin: 18px 0;
}
fieldset button {
  padding: 9px 22px;
  border: 1px solid #d9cfbb;
  background: #fff;
  border-radius: 10px;
  width: calc(50% - 3px);
  margin-right: 3px;
}
fieldset button[aria-pressed='true'] {
  background: #5b7f5e;
  color: #ffffff;
}
fieldset button:last-child[aria-pressed='true'] {
  background: #c0392b;
}
.dropzone {
  border: 1px dashed #cbb78e;
  border-radius: 10px;
  padding: 20px;
  text-align: center;
  position: relative;
  cursor: pointer;
}
.dropzone span {
  display: block;
  font-size: 12px;
  margin-top: 8px;
}
.dropzone input {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  cursor: pointer;
}
.thumbs {
  display: flex;
  gap: 10px;
}
.thumbs > div {
  position: relative;
}
.thumbs img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
}
.thumbs button {
  position: absolute;
  right: 0;
  top: 0;
}
.error {
  color: #a1342c;
  font-size: 13px;
}
footer {
  flex-wrap: wrap;
  border-top: 1px solid #e8decd;
  background: white;
}
footer .hint {
  flex: 1;
  min-width: 110px;
}
footer button {
  padding: 10px;
  border: 1px solid #d9cfbb;
  border-radius: 8px;
}
footer .publish {
  background: #e9b949;
  color: #2b2a26;
}
button:disabled {
  opacity: 0.5;
  cursor: wait;
}
@media (max-width: 400px) {
  footer .hint {
    display: none;
  }
  footer {
    justify-content: flex-end;
  }
  .review-fields,
  header,
  footer {
    padding: 14px;
  }
  .preview-strip :deep(.cup-badge) {
    font-size: 11px;
  }
}
</style>

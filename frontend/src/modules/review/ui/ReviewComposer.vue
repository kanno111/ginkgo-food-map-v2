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
import { useReviewPhotos } from '../model/useReviewPhotos'
import { MAX_REVIEW_PHOTOS } from '../model/review'
import type { ReviewPublishReceipt } from '../model/review'
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
let requestId = '',
  submittedContent = '',
  owner: string | null = null,
  generation = 0,
  controller: globalThis.AbortController | undefined
const receipt = ref<ReviewPublishReceipt | null>(null)
const photoInput = ref<globalThis.HTMLInputElement>()
const photoDraft = useReviewPhotos(gateway, () => owner)
const { photos, pending: uploadingPhotos, failed: failedPhotos } = photoDraft
const locked = computed(() => opened.value && owner !== authToken.value)
const supportsPhotos = gateway.supportsPhotos !== false
const total = computed(() => overall(scores.value))
const current = computed(() => restaurants.value.find((r) => r.id === selected.value))
// 当前无本人代表评分上下文，不能继续使用“每条评价加一票”的旧预测公式。
/** 原生dialog提供焦点圈定和Escape；关闭后释放草稿图片URL，旧异步请求不得回填。 */
function close() {
  const published = opened.value && !!receipt.value
  generation++
  controller?.abort()
  opened.value = false
  busy.value = false
  processing.value = false
  dialog.value?.close?.()
  photoDraft.clear(!!receipt.value)
  if (published) emit('published')
}
function requestClose() {
  if (!busy.value) close()
}
function finish() {
  close()
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
  receipt.value = null
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
  if (!files || processing.value || busy.value || locked.value) return
  if (!supportsPhotos) {
    error.value = '图片上传尚未开放，请先发布文字点评。'
    return
  }
  error.value = ''
  if (photos.value.length + files.length > MAX_REVIEW_PHOTOS) {
    error.value = '最多添加5张照片，请先移除多余照片。'
    return
  }
  processing.value = true
  const ticket = generation
  try {
    for (const file of Array.from(files)) {
      const compressed = await compressPhoto(file)
      if (ticket !== generation) return
      photoDraft.add(compressed)
    }
  } catch (reason) {
    if (ticket === generation)
      error.value = reason instanceof Error ? reason.message : '图片处理失败，请重试。'
  } finally {
    if (ticket === generation) processing.value = false
  }
}
function removePhoto(index: number) {
  if (!busy.value) photoDraft.remove(index)
}
async function submit() {
  if (busy.value || processing.value || receipt.value) return
  if (uploadingPhotos.value || failedPhotos.value) {
    error.value = '请等待照片上传完成；失败照片可重试或移除。'
    return
  }
  if (owner !== authToken.value || !auth.authenticated) {
    error.value = '登录身份已变化，请关闭后重新打开。'
    return
  }
  // 错误显示在固定操作区，避免校验提示被表单滚动区域遮住。
  if (!selected.value) {
    error.value = '请选择要评价的餐厅。'
    return
  }
  if (!validBody(body.value, 5, 500)) {
    error.value = '请填写5–500字的评价（不计首尾空白）。'
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
    photos.value.map((p) => p.fileId ?? p.url),
  ])
  if (submittedContent && submittedContent !== content) requestId = globalThis.crypto.randomUUID()
  submittedContent = content
  try {
    const result = await gateway.publish({
      restaurantId: selected.value,
      scores: { ...scores.value },
      recommended: recommended.value,
      body: body.value.trim(),
      photos: photos.value.map((p) => p.file),
      photoIds: photos.value.flatMap((p) => (p.fileId ? [p.fileId] : [])),
      clientRequestId: requestId,
    })
    if (ticket === generation && owner === authToken.value) {
      if (result) receipt.value = result
      else {
        close()
        emit('published')
      }
    }
  } catch (reason) {
    if (ticket === generation)
      error.value = reason instanceof Error ? reason.message : '发布失败，草稿已保留。'
  } finally {
    if (ticket === generation) busy.value = false
  }
}
watch(
  authToken,
  (token) => {
    if (!opened.value) return
    if (!token) {
      generation++
      controller?.abort()
      busy.value = false
      error.value = '登录状态已失效，当前正文已锁定保留，请复制后重新登录。不会以其他账号提交。'
    } else {
      close()
      body.value = ''
      receipt.value = null
    }
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
  <dialog ref="dialog" class="review-dialog" @cancel.prevent="requestClose">
    <section v-if="receipt" class="publish-receipt" role="status">
      <h2>{{ receipt.replayed ? '已确认此前发布成功' : '点评发布成功' }}</h2>
      <p>你的点评已发布成功，所选照片已按顺序绑定。</p>
      <dl>
        <dt>餐厅</dt>
        <dd>{{ current?.name }}</dd>
        <dt>点评编号</dt>
        <dd class="receipt-id">{{ receipt.reviewId }}</dd>
      </dl>
      <p class="hint">
        关闭后将刷新餐厅详情中的点评列表；首页发布后可进入餐厅详情查看。可展开历史点评；餐厅评分统计暂未接通。
      </p>
      <button type="button" class="publish" @click="finish">完成</button>
    </section>
    <form v-else @submit.prevent="submit">
      <header>
        <h2>写一条评价</h2>
        <button type="button" aria-label="关闭评价" :disabled="busy" @click="requestClose">
          ×
        </button>
      </header>
      <p class="rating-policy">
        如果你已评价过这家店，本条将更新你参与计分的四维评分和推荐态度；此前的点评仍会保留。
      </p>
      <div v-show="!locked" class="review-fields">
        <fieldset class="review-inputs" :disabled="busy || locked">
          <label
            >评价哪家店<select v-model="selected" :disabled="loading">
              <option value="">{{ loading ? '正在加载餐厅…' : '请选择餐厅' }}</option>
              <option v-for="r in restaurants" :key="r.id" :value="r.id">
                {{ r.name }}{{ r.closed ? '（已停业）' : '' }}
              </option>
            </select></label
          >
          <RouterLink
            class="add-missing"
            to="/restaurants/new"
            :aria-disabled="busy || locked"
            @click="busy || locked ? $event.preventDefault() : close()"
            >找不到要评价的店？添加餐厅 →</RouterLink
          >
          <div class="preview-strip">
            <span
              >本条总分 <b>{{ total.toFixed(2) }}</b></span
            ><CupBadge :tier="tierOf(total)" /><span
              >餐厅综合分发布后由后端更新，当前暂不提供预测。</span
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
            四项都是0–10分，步进0.5；杯型仅对应本条评分。本条总分 {{ total.toFixed(2) }}
          </p>
          <fieldset>
            <legend>你的判断</legend>
            <button type="button" :aria-pressed="recommended" @click="recommended = true">
              推荐</button
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
          <!-- 初始上传框与缩略图列表共用一个选图入口，图片不再堆在大框下方。 -->
          <section
            class="photo-picker"
            aria-label="点评照片"
            @dragover.prevent
            @drop.prevent="addPhotos($event.dataTransfer?.files ?? null)"
          >
            <input
              ref="photoInput"
              class="photo-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              :disabled="processing || !supportsPhotos"
              @change="
                addPhotos(($event.target as HTMLInputElement).files)
                ;($event.target as HTMLInputElement).value = ''
              "
            />
            <button
              v-if="!photos.length"
              type="button"
              class="dropzone"
              :disabled="processing || !supportsPhotos"
              @click="photoInput?.click()"
            >
              照片（最多5张，自动压缩）<span>把图片拖到这里，或点击选择</span>
            </button>
            <div v-else class="thumbs">
              <div v-for="(photo, i) in photos" :key="photo.url" class="photo-card">
                <div class="photo-preview">
                  <img :src="photo.url" alt="待发布照片" />
                  <button
                    type="button"
                    class="photo-remove"
                    aria-label="移除照片"
                    @click="removePhoto(i)"
                  >
                    ×
                  </button>
                </div>
                <p role="status" class="photo-status">
                  {{
                    photo.state === 'uploading'
                      ? '上传中…'
                      : photo.state === 'uploaded'
                        ? '已上传'
                        : photo.error
                  }}
                </p>
                <button
                  v-if="photo.state === 'failed'"
                  class="photo-retry"
                  type="button"
                  @click="photoDraft.retry(photo)"
                >
                  重试上传
                </button>
              </div>
              <button
                v-if="photos.length < MAX_REVIEW_PHOTOS"
                type="button"
                class="photo-add"
                aria-label="继续添加照片"
                :disabled="processing || !supportsPhotos"
                @click="photoInput?.click()"
              >
                <span aria-hidden="true">＋</span>
              </button>
            </div>
            <p class="hint">
              {{
                !supportsPhotos
                  ? '图片上传尚未开放，本次仅支持文字点评。'
                  : processing
                    ? '正在压缩图片…'
                    : `已选${photos.length}/${MAX_REVIEW_PHOTOS}张 · 本地预览，最长边1200px，每张不超过300KiB。`
              }}
            </p>
          </section>
        </fieldset>
      </div>
      <section v-if="locked" class="locked-message">
        <label
          >待复制的正文<textarea
            :value="body"
            readonly
            rows="4"
            @focus="($event.target as HTMLTextAreaElement).select()"
          />
        </label>
      </section>
      <footer>
        <!-- 反馈与提交按钮放在同一个固定区域，校验、网络错误和等待状态始终可见。 -->
        <p v-if="error" role="alert" class="error submit-feedback">{{ error }}</p>
        <p v-else-if="busy || loading || processing" role="status" class="hint submit-feedback">
          {{
            busy
              ? '正在发布点评，请稍候…'
              : loading
                ? '正在加载餐厅，请稍候…'
                : '正在处理照片，请稍候…'
          }}
        </p>
        <span class="hint">认真评价，对下一位同学负责。</span
        ><button type="button" :disabled="busy" @click="requestClose">取消</button
        ><button
          class="publish"
          :disabled="busy || processing || loading || locked || uploadingPhotos || failedPhotos"
          type="submit"
        >
          {{ busy ? '发布中…' : uploadingPhotos ? '照片上传中…' : '提交评价' }}
        </button>
      </footer>
    </form>
  </dialog>
</template>
<style scoped>
.publish-receipt {
  padding: 28px;
  line-height: 1.8;
}
.publish-receipt h2 {
  margin-top: 0;
}
.publish-receipt dl {
  padding: 14px;
  background: #fff7e6;
  border-radius: 12px;
}
.publish-receipt dt {
  font-size: 12px;
  color: #8c7958;
}
.publish-receipt dd {
  margin: 4px 0 14px;
  overflow-wrap: anywhere;
}
.receipt-id {
  user-select: all;
}
.locked-message {
  padding: 0 20px;
}
.review-fields {
  border: 0;
  margin: 0;
  min-width: 0;
  width: 100%;
}

.rating-policy {
  padding: 12px;
  background: #fff8e8;
  border-radius: 10px;
  color: #8c7040;
  font-size: 12px;
  line-height: 1.8;
}
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
  overflow: hidden;
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
.review-inputs {
  min-width: 0;
  margin: 0;
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
.photo-input {
  display: none;
}
.review-fields .dropzone {
  width: 100%;
  margin: 0;
  border: 1px dashed #cbb78e;
  border-radius: 10px;
  padding: 20px;
  text-align: center;
  background: #fdfbf7;
}
.dropzone span {
  display: block;
  font-size: 12px;
  margin-top: 8px;
}
.thumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
}
.photo-card {
  width: 80px;
  min-width: 0;
}
.photo-preview {
  width: 80px;
  height: 80px;
  position: relative;
}
.thumbs img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
}
.review-fields .photo-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 22px;
  height: 22px;
  margin: 0;
  padding: 0;
  border: 2px solid white;
  border-radius: 50%;
  background: #342e25;
  color: white;
  line-height: 18px;
}
.review-fields .photo-add {
  display: grid;
  place-items: center;
  flex: 0 0 80px;
  width: 80px;
  height: 80px;
  margin: 0;
  padding: 0;
  border: 1px dashed #cbb78e;
  border-radius: 8px;
  background: #fdfbf7;
  color: #8c7958;
  font-size: 32px;
  line-height: 1;
}
.photo-status {
  margin: 6px 0 0;
  font-size: 11px;
  color: #80735d;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.review-fields .photo-retry {
  width: 100%;
  margin: 4px 0 0;
  padding: 4px 0;
  font-size: 11px;
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
footer .submit-feedback {
  flex: 0 0 100%;
  margin: 0;
  overflow-wrap: anywhere;
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
  footer .hint:not(.submit-feedback) {
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

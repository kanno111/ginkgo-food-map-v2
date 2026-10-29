<script setup lang="ts">
import { inject, onUnmounted, ref, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { authToken } from '@/shared/api/authSession'
import { useLoginStore } from '@/modules/auth/model/login.store'
import { ratingDimensions } from '@/modules/restaurant/model/catalog.logic'
import { reviewGatewayKey, unavailableReviewGateway, validBody, overall } from '../model/review'
import type { ReviewItem } from '../model/review'
const props = defineProps<{ restaurantId: string }>(),
  emit = defineEmits<{ changed: [] }>()
const gateway = inject(reviewGatewayKey, unavailableReviewGateway),
  auth = useLoginStore(),
  router = useRouter(),
  route = useRoute()
const records = ref<ReviewItem[]>([]),
  loading = ref(false),
  error = ref(''),
  texts = ref<Record<string, string>>({}),
  busy = ref(false),
  photo = ref(''),
  lightbox = ref<globalThis.HTMLDialogElement>(),
  deleting = ref<ReviewItem | null>(null),
  confirm = ref<globalThis.HTMLDialogElement>()
let controller: globalThis.AbortController | undefined,
  generation = 0
const replyRequests = new Map<string, { body: string; id: string }>()
const wall = computed(() =>
  [...new Map(records.value.flatMap((r) => r.photos).map((p) => [p.id, p])).values()].slice(0, 12),
)
/** 真实传输由适配器提供；未接通时显示失败状态，绝不使用模拟评价回填。 */
async function load() {
  const ticket = ++generation
  controller?.abort()
  controller = new globalThis.AbortController()
  loading.value = true
  records.value = []
  error.value = ''
  try {
    const result = await gateway.list(props.restaurantId, controller.signal)
    if (ticket === generation) records.value = result
  } catch (reason) {
    if (ticket === generation)
      error.value = reason instanceof Error ? reason.message : '评价加载失败，请重试。'
  } finally {
    if (ticket === generation) loading.value = false
  }
}
watch(
  () => props.restaurantId,
  () => void load(),
  { immediate: true },
)
watch(authToken, () => {
  texts.value = {}
  replyRequests.clear()
  deleting.value = null
  confirm.value?.close?.()
  // 身份改变后重新读取可管理标记，避免沿用上一账号看到的删除入口。
  void load()
})
onUnmounted(() => {
  generation++
  controller?.abort()
})
async function reply(item: ReviewItem) {
  if (!auth.authenticated) {
    await router.push({ path: '/login', query: { redirect: route.path } })
    return
  }
  const text = texts.value[item.id] ?? ''
  if (!validBody(text, 1, 200)) {
    error.value = '回复需要1–200字。'
    return
  }
  if (busy.value) return
  busy.value = true
  const owner = authToken.value,
    ticket = generation
  // 网络失败保留同次请求号；账号切换或正文改变才生成新号。
  let request = replyRequests.get(item.id)
  if (!request || request.body !== text.trim()) {
    request = { body: text.trim(), id: globalThis.crypto.randomUUID() }
    replyRequests.set(item.id, request)
  }
  try {
    await gateway.reply(item.id, text.trim(), request.id)
    if (owner === authToken.value && ticket === generation) {
      replyRequests.delete(item.id)
      texts.value[item.id] = ''
      await load()
      emit('changed')
    }
  } catch (reason) {
    if (ticket === generation && owner === authToken.value)
      error.value = reason instanceof Error ? reason.message : '回复失败，文字已保留。'
  } finally {
    busy.value = false
  }
}
function askDelete(item: ReviewItem) {
  deleting.value = item
  confirm.value?.showModal()
}
function cancelDelete() {
  confirm.value?.close?.()
  deleting.value = null
}
async function remove() {
  if (!deleting.value || busy.value) return
  busy.value = true
  const ticket = generation,
    owner = authToken.value
  try {
    await gateway.remove(deleting.value.id)
    if (ticket === generation && owner === authToken.value) {
      confirm.value?.close?.()
      deleting.value = null
      await load()
      emit('changed')
    }
  } catch (reason) {
    if (ticket === generation && owner === authToken.value)
      error.value = reason instanceof Error ? reason.message : '删除失败。'
  } finally {
    busy.value = false
  }
}
function view(url: string) {
  photo.value = url
  lightbox.value?.showModal()
}
</script>
<template>
  <section class="review-panel" aria-labelledby="reviews-title">
    <header>
      <h2 id="reviews-title">同学点评</h2>
      <button type="button" :disabled="loading" @click="load">刷新评价</button>
    </header>
    <p v-if="loading" role="status">正在加载评价…</p>
    <div v-else-if="error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="load">重试</button>
    </div>
    <p v-else-if="!records.length" class="empty">还没有人评价，来当第一个吧。</p>
    <details v-if="wall.length" class="student-album">
      <summary>同学上传的照片（{{ wall.length }}） · 查看照片与原点评</summary>
      <p>下方各条点评保留作者和照片对应关系，点击照片可查看大图。</p>
    </details>
    <div class="photos">
      <button v-for="p in wall" :key="p.id" type="button" @click="view(p.url)">
        <img :src="p.url" alt="餐厅评价照片" loading="lazy" />
      </button>
    </div>
    <article v-for="item in records" :key="item.id" class="review-card">
      <header>
        <span class="avatar">{{ Array.from(item.username)[0] }}</span>
        <div>
          <strong>{{ item.username }}</strong
          ><time :datetime="item.createdAt">{{
            new Date(item.createdAt).toLocaleString('zh-CN')
          }}</time>
        </div>
        <span class="verdict"
          >{{ item.recommended ? '推荐' : '不推荐' }} · {{ overall(item.scores).toFixed(2) }}</span
        >
      </header>
      <p class="chips">
        <span v-for="d in ratingDimensions" :key="d.key"
          >{{ d.label }} {{ item.scores[d.key].toFixed(1) }}</span
        >
      </p>
      <p class="body">{{ item.body }}</p>

      <div class="photos">
        <button v-for="p in item.photos" :key="p.id" type="button" @click="view(p.url)">
          <img :src="p.url" alt="评价照片" loading="lazy" />
        </button>
      </div>
      <button v-if="item.canDelete && auth.authenticated" type="button" @click="askDelete(item)">
        删除评价
      </button>
      <details class="review-evidence">
        <summary>含{{ item.photos.length }}张照片 · 评价依据 ›</summary>
        <p>
          发布时间：{{ new Date(item.createdAt).toLocaleString('zh-CN') }}。{{
            item.photos.length ? '照片由作者上传，未核验到店。' : '本条未附照片。'
          }}账号和附图不构成真实性保证。
        </p>
      </details>
      <div class="replies">
        <p v-for="answer in item.replies" :key="answer.id">
          <strong>{{ answer.username }}</strong
          >：{{ answer.body
          }}<time :datetime="answer.createdAt">{{
            new Date(answer.createdAt).toLocaleDateString('zh-CN')
          }}</time>
        </p>
        <form @submit.prevent="reply(item)">
          <input
            v-model="texts[item.id]"
            :aria-label="'回复' + item.username"
            placeholder="说点什么（1–200字）"
            @keydown.enter="$event.isComposing && $event.preventDefault()"
          /><button :disabled="busy">回复</button>
        </form>
      </div>
    </article>
    <dialog ref="confirm">
      <h3>确定删除这条评价？</h3>
      <p>回复和照片将一并删除，删除后无法恢复。</p>
      <button type="button" @click="cancelDelete">取消</button
      ><button type="button" :disabled="busy" @click="remove">确认删除</button>
    </dialog>
    <dialog ref="lightbox" class="lightbox">
      <button type="button" aria-label="关闭大图" @click="lightbox?.close()">关闭 ×</button
      ><img :src="photo || undefined" alt="评价照片大图" />
    </dialog>
  </section>
</template>
<style scoped>
.review-panel {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  padding: 26px;
  background: #fffdf8;
  border: 1px solid #e2d9c9;
  border-radius: 18px;
  min-width: 0;
}
header {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
}
h2 {
  font-size: 17px;
  margin: 0;
}
button {
  font: inherit;
  background: transparent;
  border: 1px solid #d9cfbb;
  border-radius: 7px;
  padding: 8px 12px;
  color: #74603d;
  cursor: pointer;
}
.review-panel > div[role='alert'] {
  font-size: 13px;
  color: #8d5a38;
  padding: 20px 0;
}
.empty {
  padding: 30px;
  text-align: center;
  color: #80735d;
}
.review-card {
  padding: 22px 0;
  border-top: 1px solid #e8dfd0;
  margin-top: 20px;
}
.review-card header {
  justify-content: flex-start;
  font-size: 13px;
}
.avatar {
  background: #e9b949;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
}
.verdict {
  margin-left: auto;
  color: #8d6535;
}
time {
  display: block;
  font-size: 11px;
  color: #92836b;
  margin-top: 5px;
}
.body {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.8;
  font-size: 14px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: #8c754f;
}
.photos {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 14px 0;
}
.photos button {
  padding: 0;
  border: 0;
}
.photos img {
  width: 82px;
  height: 82px;
  object-fit: cover;
  border-radius: 8px;
}
.replies {
  background: #f6f0e4;
  padding: 14px;
  border-radius: 10px;
  margin-top: 14px;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.replies form {
  display: flex;
  gap: 8px;
}
.replies form button {
  flex-shrink: 0;
  white-space: nowrap;
}
.replies input {
  min-width: 0;
  width: 100%;
  border: 1px solid #dfd2ba;
  border-radius: 7px;
  padding: 10px;
  font: inherit;
}
dialog {
  max-width: calc(100% - 28px);
  border: 0;
  border-radius: 12px;
  padding: 20px;
  background: #fffdf8;
}
.lightbox img {
  display: block;
  max-width: 85vw;
  max-height: 75dvh;
  margin-top: 10px;
}
dialog::backdrop {
  background: #242018bb;
}
@media (max-width: 400px) {
  .review-panel {
    padding: 16px;
  }
  .verdict {
    font-size: 11px;
  }
  .replies {
    padding: 8px;
  }
}

.review-evidence,
.student-album {
  font-size: 12px;
  color: #61758a;
  background: #f1f5f8;
  padding: 10px 12px;
  border-radius: 9px;
  margin: 12px 0;
  line-height: 1.8;
}
.review-evidence summary,
.student-album summary {
  cursor: pointer;
}
.review-evidence p {
  margin: 8px 0 0;
}
.review-panel {
  background: white;
}
.review-card {
  padding-top: 16px;
}
.review-card .avatar {
  flex-shrink: 0;
}
.review-card header > div {
  min-width: 0;
  overflow-wrap: anywhere;
}
.verdict {
  white-space: nowrap;
}
</style>

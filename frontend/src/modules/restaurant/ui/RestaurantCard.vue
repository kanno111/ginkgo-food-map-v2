<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import { useRestaurantReviewPreview } from '@/modules/review'
import { campusDistance, priceLabel, tierOf } from '../model/catalog.logic'
import type { RestaurantReadModel } from '../model/restaurant.types'
import CupBadge from './CupBadge.vue'

const props = defineProps<{ restaurant: RestaurantReadModel }>()
const { photo, count, state } = useRestaurantReviewPreview(toRef(() => props.restaurant.id))
const imageFailed = ref(false)
watch(photo, () => {
  imageFailed.value = false
})
const distance = computed(() => campusDistance(props.restaurant))
</script>

<template>
  <RouterLink class="restaurant-card" :to="`/restaurants/${encodeURIComponent(restaurant.id)}`">
    <div class="card-media">
      <img
        v-if="photo && !imageFailed"
        :src="photo.url"
        :alt="`${restaurant.name}的点评配图`"
        loading="lazy"
        decoding="async"
        @error="imageFailed = true"
      />
      <span v-if="photo && !imageFailed" class="photo-credit">{{ photo.label }}</span>
      <div
        v-else
        class="catalog-photo-placeholder"
        :aria-label="imageFailed ? '图片暂时无法加载' : '暂无可展示点评照片'"
      >
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path
            d="M12 28h40c-2 17-9 22-20 22S14 45 12 28Zm7 27h26M25 10v10m9-12v12m9-10v10"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
          /></svg
        ><small>{{
          imageFailed
            ? '图片暂时无法加载'
            : state === 'loading'
              ? '正在寻找好味道…'
              : state === 'error'
                ? '点评配图暂不可用'
                : '等你分享美食照片'
        }}</small>
      </div>
    </div>
    <div class="card-copy">
      <div class="card-top">
        <span class="category-label">{{ restaurant.category }}</span>
        <CupBadge :tier="tierOf(restaurant.score)" compact />
      </div>
      <h3>{{ restaurant.name }}<span class="card-arrow" aria-hidden="true">↗</span></h3>
      <p class="card-rating">
        {{ restaurant.score === null ? '待评级' : `${restaurant.score.toFixed(1)}分` }}
        <small
          >·
          {{
            count === null
              ? state === 'error'
                ? '评价数暂不可用'
                : '评价数待读取'
              : `${count} 条评价`
          }}</small
        >
      </p>
      <p class="card-address">{{ restaurant.address || '地址待补充' }}</p>
      <div class="tag-list">
        <span v-for="tag in restaurant.tags.slice(0, 2)" :key="tag">{{ tag }}</span>
      </div>
      <div class="card-meta">
        <span class="card-price"
          >{{ priceLabel(restaurant)
          }}<small v-if="restaurant.priceKind === 'estimate'"> / 人 · 估值</small></span
        >
        <span>{{ distance === null ? '位置待补' : `距校区 ${distance.toFixed(1)} km` }}</span>
      </div>
      <div class="card-foot">
        <span>{{
          count === null ? '查看同学用餐体验' : count ? '看看同学怎么说' : '等你留下第一条点评'
        }}</span>
        <span v-if="restaurant.closed" class="closed-label">标注停业</span>
        <span v-else>查看详情 <span aria-hidden="true">→</span></span>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
/* 图片与占位保留相同比例，防止加载时卡片高度跳动。 */
.restaurant-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--discovery-border, #f0e9df);
  border-radius: 16px;
  background: white;
  text-decoration: none;
  box-shadow: 0 3px 14px #50341605;
  transition:
    transform 160ms,
    box-shadow 160ms,
    border-color 160ms;
}
.restaurant-card:hover {
  transform: translateY(-3px);
  border-color: #e7c58c;
  box-shadow: 0 8px 24px #5034160d;
}
.restaurant-card:focus-visible {
  outline: 3px solid #f59e0b;
  outline-offset: 3px;
}
.card-media {
  position: relative;
  aspect-ratio: 2 / 1;
  background: #f8f2e8;
  overflow: hidden;
}
.card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.photo-credit {
  position: absolute;
  bottom: 10px;
  left: 12px;
  right: 12px;
  width: fit-content;
  max-width: calc(100% - 24px);
  padding: 4px 8px;
  background: #24211ed6;
  color: white;
  border-radius: 6px;
  font-size: 10px;
}
.catalog-photo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 8px;
  color: #a29176;
  background: radial-gradient(ellipse at 50% 35%, #fffaf0, #f3ebde);
}
.catalog-photo-placeholder svg {
  width: 52px;
  height: 52px;
}
.catalog-photo-placeholder small {
  font-size: 11px;
}
.card-copy {
  padding: 16px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.card-top,
.card-meta,
.card-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.category-label {
  color: #83735d;
  font-size: 12px;
}
h3 {
  margin: 8px 0;
  font-size: 18px;
  line-height: 1.5;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.card-arrow {
  float: right;
  color: #ae9e85;
  font-weight: 400;
}
.card-rating {
  margin: 0 0 8px;
  color: #aa6911;
  font-size: 18px;
  font-weight: 700;
}
.card-rating small {
  font-size: 11px;
  font-weight: 400;
  color: #858585;
}
.card-address {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #858585;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
.tag-list {
  display: flex;
  gap: 4px;
  margin: 12px 0;
  min-height: 22px;
  overflow: hidden;
}
.tag-list span {
  padding: 4px 6px;
  border-radius: 6px;
  background: #faf6ee;
  color: #89775c;
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-meta {
  margin-top: auto;
  flex-wrap: wrap;
  color: #858585;
  font-size: 11px;
}
.card-price {
  color: #252525;
  font-size: 16px;
  font-weight: 700;
}
.card-price small {
  color: #858585;
  font-size: 10px;
  font-weight: 400;
}
.card-foot {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0e9df;
  font-size: 11px;
  color: #9a7a48;
}
.closed-label {
  color: #985e4f;
}
@media (prefers-reduced-motion: reduce) {
  .restaurant-card {
    transition: none;
  }
  .restaurant-card:hover {
    transform: none;
  }
}
</style>

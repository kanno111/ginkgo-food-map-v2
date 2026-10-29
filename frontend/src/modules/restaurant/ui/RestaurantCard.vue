<script setup lang="ts">
import { computed } from 'vue'
import { campusDistance, priceLabel, tierOf } from '../model/catalog.logic'
import type { RestaurantReadModel } from '../model/restaurant.types'
import CupBadge from './CupBadge.vue'

const props = defineProps<{ restaurant: RestaurantReadModel }>()
const distance = computed(() => campusDistance(props.restaurant))
</script>

<template>
  <RouterLink class="restaurant-card" :to="`/restaurants/${encodeURIComponent(restaurant.id)}`">
    <div class="catalog-photo-placeholder" aria-label="暂无同学上传照片">
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path
          d="M12 28h40c-2 17-9 22-20 22S14 45 12 28Zm7 27h26M25 10v10m9-12v12m9-10v10"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
        /></svg
      ><small>暂无同学上传照片</small>
    </div>
    <div class="card-copy">
      <div class="card-top">
        <span class="category-label">{{ restaurant.category }}</span>
        <CupBadge :tier="tierOf(restaurant.score)" compact />
      </div>
      <h3>{{ restaurant.name }}<span class="card-arrow" aria-hidden="true">↗</span></h3>
      <p class="card-rating">
        {{ restaurant.score === null ? '待评级' : `${restaurant.score.toFixed(1)}分` }}
        <small>· {{ restaurant.reviewCount }} 条评价</small>
      </p>
      <p class="card-address">{{ restaurant.address || '地址待补充' }}</p>
      <div class="tag-list">
        <span v-for="tag in restaurant.tags.slice(0, 3)" :key="tag">{{ tag }}</span>
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
          restaurant.reviewCount ? `${restaurant.reviewCount} 条评价` : '等待第一条真实评价'
        }}</span>
        <span v-if="restaurant.closed" class="closed-label">标注停业</span>
        <span v-else>查看详情 <span aria-hidden="true">→</span></span>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
.restaurant-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 24px;
  border: 1px solid #e0dacc;
  border-radius: 20px;
  background: #fffdf8;
  text-decoration: none;
  transition:
    border-color 160ms,
    transform 160ms,
    box-shadow 160ms;
}
.restaurant-card:hover {
  border-color: #baa47b;
  transform: translateY(-3px);
  box-shadow: 0 12px 30px #4c360810;
}
.restaurant-card:focus-visible {
  outline: 3px solid #ac7c20;
  outline-offset: 3px;
}
.card-top,
.card-meta,
.card-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.category-label {
  font-size: 12px;
  color: #786b54;
  font-weight: 800;
  letter-spacing: 0.08em;
}
h3 {
  margin: 19px 0 10px;
  font-size: 19px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.card-arrow {
  float: right;
  margin-left: 8px;
  color: #b0a28a;
}
.card-address {
  margin: 0;
  color: #746a58;
  font-size: 12px;
  line-height: 1.7;
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 16px 0 22px;
}
.tag-list span {
  border-radius: 5px;
  padding: 4px 7px;
  color: #6f685b;
  background: #f3efe6;
  font-size: 12px;
}
.card-meta {
  margin-top: auto;
  align-items: baseline;
  color: #746a58;
  font-size: 12px;
  flex-wrap: wrap;
}
.card-price {
  color: #2b2a26;
  font-size: 18px;
  font-weight: 700;
}
.card-price small {
  color: #746a58;
  font-size: 12px;
  font-weight: 400;
}
.card-foot {
  margin-top: 18px;
  padding-top: 15px;
  border-top: 1px dashed #e6dfd2;
  font-size: 12px;
  color: #75654f;
}
.closed-label {
  color: #8b4e3d;
}
@media (max-width: 480px) {
  .restaurant-card {
    padding: 20px;
  }
}

.restaurant-card {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 18px;
  padding: 16px;
  border-radius: 16px;
  background: white;
  align-items: start;
}
.catalog-photo-placeholder {
  border-radius: 12px;
  background: #f7f0e1;
  color: #a79677;
  min-height: 132px;
  display: grid;
  place-content: center;
  text-align: center;
  padding: 8px;
}
.catalog-photo-placeholder svg {
  width: 52px;
  height: 52px;
  margin: auto;
}
.catalog-photo-placeholder small {
  font-size: 10px;
  margin-top: 10px;
}
.card-copy {
  min-width: 0;
}
.card-top {
  gap: 8px;
}
.category-label {
  letter-spacing: 0;
}
.card-rating {
  font-size: 20px;
  font-weight: 700;
  color: #bb7a16;
  margin: 8px 0;
}
.card-rating small {
  font-size: 11px;
  font-weight: 400;
  color: #7d735f;
}
h3 {
  margin: 8px 0 4px;
  font-size: 19px;
}
.card-price {
  font-size: 15px;
}
.tag-list {
  margin: 8px 0;
  gap: 4px;
}
.tag-list span {
  font-size: 10px;
  padding: 3px 5px;
}
.card-foot {
  padding-top: 8px;
  margin-top: 10px;
  gap: 5px;
  font-size: 10px;
}
.card-meta {
  gap: 5px;
  font-size: 11px;
}
.card-address {
  font-size: 11px;
}
@media (max-width: 480px) {
  .restaurant-card {
    grid-template-columns: 86px minmax(0, 1fr);
    gap: 12px;
    padding: 12px;
  }
  .catalog-photo-placeholder {
    min-height: 112px;
    padding: 5px;
  }
  .catalog-photo-placeholder small {
    font-size: 9px;
  }
  h3 {
    font-size: 16px;
  }
  .card-top :deep(.cup-badge) {
    font-size: 10px;
  }
  .card-foot {
    flex-wrap: wrap;
  }
  .card-price small {
    font-size: 10px;
  }
}
</style>

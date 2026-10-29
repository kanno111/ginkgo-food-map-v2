<script setup lang="ts">
import { computed } from 'vue'
import type { RestaurantReadModel } from '@/modules/restaurant/model/restaurant.types'
import { ratingDimensions } from '@/modules/restaurant/model/catalog.logic'
const props = defineProps<{ dimensions: RestaurantReadModel['dimensions'] }>()
/** 空评分不绘制假雷达面积，0分保留真实零值。 */
const points = computed(() => {
  const { taste, value, service, ambience } = props.dimensions
  return `100,${100 - (taste ?? 0) * 6} ${100 + (value ?? 0) * 6},100 100,${100 + (service ?? 0) * 6} ${100 - (ambience ?? 0) * 6},100`
})
</script>
<template>
  <div class="rating-chart">
    <svg viewBox="0 0 200 200" role="img" aria-label="四维评分雷达图">
      <polygon
        v-for="r in [20, 40, 60]"
        :key="r"
        :points="`100,${100 - r} ${100 + r},100 100,${100 + r} ${100 - r},100`"
        fill="none"
        stroke="#ded4bf"
      />
      <path d="M100 40V160M40 100H160" stroke="#ded4bf" />
      <polygon
        v-if="Object.values(dimensions).some((v) => v !== null)"
        :points="points"
        fill="#e9b94955"
        stroke="#b58b2c"
        stroke-width="2"
      />
      <g font-size="11" fill="#7d6a4b" text-anchor="middle">
        <text x="100" y="25">味道</text>
        <text x="180" y="104">性价比</text>
        <text x="100" y="185">服务</text>
        <text x="20" y="104">环境</text>
      </g>
    </svg>
    <div class="bars">
      <div v-for="d in ratingDimensions" :key="d.key">
        <span>{{ d.label }}</span
        ><meter min="0" max="10" :value="dimensions[d.key] ?? 0" :aria-label="d.label" /><span>{{
          dimensions[d.key]?.toFixed(1) ?? '暂无'
        }}</span>
      </div>
    </div>
  </div>
</template>
<style scoped>
.rating-chart {
  display: flex;
  align-items: center;
  gap: 15px;
}
.rating-chart svg {
  width: 180px;
  max-width: 45%;
  flex-shrink: 0;
}
.bars {
  flex: 1;
  min-width: 0;
}
.bars > div {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #7d6a4b;
  margin: 15px 0;
}
.bars meter {
  width: 100%;
  min-width: 20px;
  accent-color: #e9b949;
}
.bars meter::-webkit-meter-bar {
  background: #efe9dd;
  border: 0;
  height: 6px;
}
.bars meter::-webkit-meter-optimum-value {
  background: #e9b949;
}
.bars meter::-moz-meter-bar {
  background: #e9b949;
}
.bars span {
  white-space: nowrap;
}
@media (max-width: 400px) {
  .rating-chart {
    flex-direction: column;
  }
  .rating-chart svg {
    max-width: 100%;
  }
  .bars {
    width: 100%;
  }
}
@media(max-width:750px){.rating-chart{display:block}.rating-chart svg{display:none}.bars{width:100%}.bars>div{margin:12px 0}.bars meter{height:12px}}
</style>

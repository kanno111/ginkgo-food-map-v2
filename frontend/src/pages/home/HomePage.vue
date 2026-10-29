<script setup lang="ts">
import { RestaurantCatalog } from '@/modules/restaurant'
import { ReviewComposer } from '@/modules/review'
import cover from '@/shared/assets/ginkgo-cover.jpg'
// 页面负责组合找店与写评入口，不把点评列表扩展为独立首页内容流。
</script>
<template>
  <div class="discovery-page">
    <h1 class="screen-reader-title">Ginkgo 美食地图</h1>
    <RestaurantCatalog />
    <div class="home-review"><ReviewComposer /></div>
    <footer class="discovery-footer">
      <figure>
        <img :src="cover" alt="原版兔子举牌封面" width="36" height="36" />
        <figcaption>不好吃，就举牌子。</figcaption>
      </figure>
      <RouterLink to="/scoring-guide">杯型评分说明 →</RouterLink>
    </footer>
  </div>
</template>
<style scoped>
.discovery-page {
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
  padding: 8px 0 20px;
}
.screen-reader-title {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.home-review :deep(.review-open) {
  display: none;
}
.discovery-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 28px;
  border-top: 1px solid #e7dfd0;
  padding: 18px 0;
  color: #8e8068;
  font-size: 12px;
}
.discovery-footer figure {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
}
.discovery-footer img {
  border-radius: 8px;
}
.discovery-footer a {
  text-decoration: none;
}
@media (max-width: 700px) {
  .discovery-page {
    width: calc(100% - 24px);
  }
}
</style>

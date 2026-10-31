<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, useTemplateRef } from 'vue'
import { useRestaurantCatalog } from '../model/catalog.store'
import RestaurantFilters from './RestaurantFilters.vue'
import RestaurantCard from './RestaurantCard.vue'
import RandomRestaurant from './RandomRestaurant.vue'

const catalog = useRestaurantCatalog()
onMounted(() => {
  void catalog.load()
})
onUnmounted(catalog.cancelPending)
const resultsHeading = useTemplateRef('resultsHeading')
/** 分页继续由服务端完成；翻页后将键盘焦点移回结果栏，不重新排列当前页。 */
async function changePage(page: number): Promise<void> {
  catalog.goToPage(page)
  await nextTick()
  resultsHeading.value?.focus({ preventScroll: true })
  resultsHeading.value?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
}
</script>

<template>
  <section id="restaurant-directory" class="restaurant-directory" aria-labelledby="directory-title">
    <div class="directory-heading">
      <h2 id="directory-title">发现好味道</h2>
      <div class="directory-links">
        <RouterLink to="/restaurants/new">没找到？添加餐厅</RouterLink
        ><RouterLink to="/scoring-guide">评分说明 →</RouterLink>
      </div>
    </div>
    <RestaurantFilters />
    <RandomRestaurant />
    <div ref="resultsHeading" class="results-toolbar" tabindex="-1" aria-label="餐厅筛选结果">
      <h2>餐厅列表</h2>
      <p role="status" aria-live="polite">
        {{ catalog.loading ? '正在加载 · ' : '' }}找到
        <strong>{{ catalog.total }}</strong> 家餐厅<span v-if="catalog.total">
          · 第 {{ catalog.page }} / {{ catalog.pages }} 页</span
        >
      </p>
    </div>
    <div v-if="catalog.error" class="directory-empty" role="alert">
      <h3>餐厅目录暂时无法加载。</h3>
      <p>{{ catalog.error }}</p>
      <button type="button" class="primary-action" @click="catalog.load">重新加载</button>
    </div>
    <div
      v-else-if="catalog.visibleRestaurants.length"
      class="restaurant-grid"
      :aria-busy="catalog.loading"
    >
      <RestaurantCard
        v-for="restaurant in catalog.visibleRestaurants"
        :key="restaurant.id"
        :restaurant="restaurant"
      />
    </div>
    <div v-else-if="catalog.loading" class="directory-empty" role="status">正在加载餐厅…</div>
    <div v-else class="directory-empty" role="status">
      <h3>换个条件，也许就遇见了。</h3>
      <p>没有找到符合条件的餐厅，试试店名、地址或不同分类。</p>
      <RouterLink class="add-missing" to="/restaurants/new">找不到这家店？添加餐厅 →</RouterLink
      ><button
        v-if="
          catalog.filters.keyword ||
          catalog.filters.category ||
          catalog.filters.hideClosed ||
          catalog.filters.maxPrice !== null ||
          catalog.filters.maxDistanceMeters !== null ||
          catalog.filters.sort !== 'score'
        "
        type="button"
        class="primary-action"
        @click="catalog.resetFilters"
      >
        清除筛选
      </button>
    </div>
    <div class="preview-notice" role="note">
      <span>餐厅目录</span>
      <p>营业、地址及消费请出发前核实。带“联调模拟”标签的店铺仅供测试，不代表真实经营情况。</p>
    </div>
    <RouterLink v-if="catalog.visibleRestaurants.length" class="add-missing" to="/restaurants/new"
      >没找到要找的店？添加餐厅 →</RouterLink
    >
    <nav
      v-if="!catalog.error && catalog.pages > 1"
      class="catalog-pagination"
      aria-label="餐厅分页"
    >
      <button
        type="button"
        :disabled="catalog.loading || catalog.page === 1"
        @click="changePage(catalog.page - 1)"
      >
        ← 上一页
      </button>
      <button
        v-for="page in catalog.pageNumbers"
        :key="page"
        type="button"
        :aria-current="catalog.page === page ? 'page' : undefined"
        :aria-label="`第 ${page} 页`"
        :disabled="catalog.loading"
        @click="changePage(page)"
      >
        {{ page }}
      </button>
      <button
        type="button"
        :disabled="catalog.loading || catalog.page === catalog.pages"
        @click="changePage(catalog.page + 1)"
      >
        下一页 →
      </button>
    </nav>
  </section>
</template>

<style scoped>
/* 页面只组合搜索筛选、随机选店和真实目录；筛选统一由独立组件管理。 */
.restaurant-directory {
  min-width: 0;
}
.directory-heading,
.directory-links,
.results-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.directory-heading {
  padding-top: 15px;
}
h2 {
  font-size: 20px;
  margin: 0;
}
.directory-links {
  font-size: 12px;
  flex-wrap: wrap;
}
a {
  color: #9a7c4d;
  text-decoration: none;
}
.results-toolbar {
  margin: 22px 0 15px;
}
.results-toolbar p {
  font-size: 12px;
  color: #938572;
  margin: 0;
}
.restaurant-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}
.directory-empty {
  padding: 50px 20px;
  text-align: center;
  border: 1px dashed #e5d8c1;
  border-radius: 14px;
  background: #fffdf8;
}
.directory-empty p {
  color: #95856d;
  line-height: 1.8;
}
.directory-empty a {
  display: block;
  margin: 15px 0;
}
.preview-notice {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  margin-top: 18px;
  border-radius: 10px;
  background: #f8f5ed;
  font-size: 11px;
  color: #95866e;
}
.preview-notice p {
  margin: 0;
  line-height: 1.8;
}
.preview-notice span {
  flex-shrink: 0;
}
.add-missing {
  display: inline-block;
  font-size: 12px;
  margin-top: 14px;
}
.catalog-pagination {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 24px;
}
.catalog-pagination button {
  min-height: 40px;
  padding: 8px 13px;
  border: 1px solid #e9dfce;
  border-radius: 8px;
  background: white;
  color: #8e744b;
  font: inherit;
  cursor: pointer;
}
.catalog-pagination button[aria-current] {
  background: #fff0d3;
  border-color: #e8ba66;
}
.catalog-pagination button:disabled {
  opacity: 0.5;
  cursor: default;
}
@media (max-width: 1000px) {
  .restaurant-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .restaurant-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }
  .directory-heading {
    align-items: start;
  }
  .directory-links {
    justify-content: flex-end;
    font-size: 11px;
    max-width: 145px;
    gap: 6px;
  }
  h2 {
    font-size: 18px;
  }
  .results-toolbar p {
    font-size: 11px;
  }
}
</style>

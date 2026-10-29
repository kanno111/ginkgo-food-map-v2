<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import { useRestaurantCatalog } from '../model/catalog.store'
import { cupTiers } from '../model/catalog.logic'
import CupBadge from './CupBadge.vue'
import RestaurantCard from './RestaurantCard.vue'
import RandomRestaurant from './RandomRestaurant.vue'

const catalog = useRestaurantCatalog()
onMounted(() => {
  void catalog.load()
})
onUnmounted(catalog.cancelPending)
// 折叠只改变展示，不清除条件；筛选与页码仍由目录状态保留。
const filtersExpanded = ref(false)
// 快捷分类使用真实字典编码，不将展示文案当作后端分类值。
const quickCategories = computed(() =>
  ['火锅', '烧烤', '面', '快餐']
    .map((name, index) => ({
      category: catalog.categories.find((c) => c.name.includes(name)),
      icon: ['🍲', '🍢', '🍜', '🍱'][index],
    }))
    .filter((entry) => entry.category),
)
const advancedCount = computed(
  () =>
    Number(Boolean(catalog.filters.category)) +
    Number(catalog.filters.view !== 'all') +
    Number(catalog.filters.hideClosed),
)
const resultsHeading = useTemplateRef('resultsHeading')

/** 翻页后返回结果栏，键盘和手机用户无需手动滚回列表顶部。 */
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
      <div>
        <h2 id="directory-title">发现好味道</h2>
      </div>
      <div class="directory-links">
        <RouterLink class="guide-link" to="/restaurants/new">没找到？添加餐厅</RouterLink>
        <RouterLink class="guide-link" to="/scoring-guide">杯型评分说明 →</RouterLink>
      </div>
    </div>
    <div class="preview-notice" role="note">
      <span class="preview-label">餐厅目录</span>
      <p>营业、地址及消费请出发前核实。带“联调模拟”标签的店铺仅供测试，不代表真实经营情况。</p>
    </div>
    <div class="directory-layout">
      <aside class="directory-filters" aria-label="餐厅筛选">
        <div class="filter-title">
          <h3>筛选餐厅</h3>
          <button type="button" @click="catalog.resetFilters">重置</button>
        </div>
        <label class="field-label" for="restaurant-search">搜索餐厅</label>
        <div class="search-field">
          <span aria-hidden="true">⌕</span
          ><input
            id="restaurant-search"
            v-model="catalog.filters.keyword"
            type="search"
            aria-label="搜索餐厅"
            placeholder="店名、地址、标签…"
            maxlength="100"
          /><button type="button" class="search-submit" @click="catalog.load">搜索</button>
        </div>
        <div class="quick-categories" aria-label="快捷分类">
          <button
            v-for="entry in quickCategories"
            :key="entry.category!.code"
            type="button"
            :aria-pressed="catalog.filters.category === entry.category!.code"
            @click="
              catalog.filters.category =
                catalog.filters.category === entry.category!.code ? '' : entry.category!.code
            "
          >
            <span aria-hidden="true">{{ entry.icon }}</span
            >{{ entry.category!.name }}</button
          ><button
            type="button"
            :aria-expanded="filtersExpanded"
            aria-controls="advanced-filters"
            @click="filtersExpanded = !filtersExpanded"
          >
            <span aria-hidden="true">▦</span>全部分类
          </button>
        </div>
        <div class="filter-controls">
          <button type="button" disabled title="当前以清水河校区为参考，区域筛选尚未开放">
            区域 · 待开放</button
          ><button type="button" disabled title="等待餐厅补充正式商户类型">商户类型 · 待补充</button
          ><button type="button" disabled title="等待餐厅补充堂食与外卖资料">
            用餐方式 · 待补充</button
          ><button
            class="mobile-filter-toggle"
            type="button"
            :aria-expanded="filtersExpanded"
            aria-controls="advanced-filters"
            @click="filtersExpanded = !filtersExpanded"
          >
            {{ filtersExpanded ? '收起筛选' : '更多筛选'
            }}<span v-if="advancedCount">（已选 {{ advancedCount }} 项）</span>
          </button>
        </div>
        <div
          v-if="advancedCount || catalog.filters.keyword || catalog.filters.tiers.length"
          class="selected-filters"
        >
          <span v-if="catalog.filters.keyword">搜索：{{ catalog.filters.keyword }}</span
          ><span v-if="catalog.filters.category">{{
            catalog.categories.find((c) => c.code === catalog.filters.category)?.name
          }}</span
          ><span v-if="catalog.filters.view !== 'all'">{{
            catalog.filters.view === 'recommended' ? '推荐' : '踩雷'
          }}</span
          ><span v-if="catalog.filters.hideClosed">隐藏标注停业</span
          ><button type="button" @click="catalog.resetFilters">清空条件 ×</button>
        </div>
        <div id="advanced-filters" class="advanced-filters" :class="{ expanded: filtersExpanded }">
          <fieldset class="category-filter">
            <legend>今天想吃</legend>
            <button
              type="button"
              :aria-pressed="catalog.filters.category === ''"
              @click="catalog.filters.category = ''"
            >
              全部分类
            </button>
            <button
              v-for="category in catalog.categories"
              :key="category.code"
              type="button"
              :aria-pressed="catalog.filters.category === category.code"
              @click="catalog.filters.category = category.code"
            >
              {{ category.name }}
            </button>
          </fieldset>
          <label class="field-label" for="restaurant-view">只看这些</label>
          <select id="restaurant-view" v-model="catalog.filters.view">
            <option value="all">全部餐厅</option>
            <option value="recommended">推荐 · 大杯及以上</option>
            <option value="pitfall">踩雷 · 小杯</option>
          </select>
          <label class="closed-filter"
            ><input v-model="catalog.filters.hideClosed" type="checkbox" />隐藏标注停业的店</label
          >
        </div>
      </aside>
      <div class="directory-content">
        <RandomRestaurant />
        <h2 class="nearby-title">餐厅推荐 <small>距离以清水河校区为参考</small></h2>
        <div class="tier-filters" aria-label="按杯型筛选">
          <button
            type="button"
            :aria-pressed="catalog.filters.tiers.length === 0"
            @click="catalog.filters.tiers = []"
          >
            全部杯型
          </button>
          <button
            v-for="tier in cupTiers"
            :key="tier.key"
            type="button"
            :aria-pressed="catalog.filters.tiers.includes(tier.key)"
            :title="tier.description"
            @click="catalog.toggleTier(tier.key)"
          >
            <CupBadge :tier="tier.key" compact />
          </button>
        </div>
        <div ref="resultsHeading" class="results-toolbar" tabindex="-1" aria-label="餐厅筛选结果">
          <p role="status" aria-live="polite">
            {{ catalog.loading ? '正在加载 · ' : '' }}找到
            <strong>{{ catalog.total }}</strong> 家餐厅<span v-if="catalog.total">
              · 第 {{ catalog.page }} / {{ catalog.pages }} 页</span
            >
          </p>
          <div class="sort-field">
            <label for="restaurant-sort">排序</label
            ><select id="restaurant-sort" v-model="catalog.filters.sort">
              <option value="score">综合评分</option>
              <option value="taste">味道</option>
              <option value="value">性价比</option>
              <option value="service">服务</option>
              <option value="ambience">环境</option>
              <option value="reviews">评价数量</option>
              <option value="price">人均从低到高</option>
              <option value="distance">离校区最近</option>
            </select>
          </div>
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
          <CupBadge tier="none" />
          <h3>换个条件，也许就遇见了。</h3>
          <p
            v-if="
              catalog.filters.view !== 'all' ||
              catalog.filters.tiers.some((tier) => tier !== 'none')
            "
          >
            当前条件下没有已评级的餐厅。没有评价的店铺为待评级，试试“全部杯型”或其他关键词。
          </p>
          <p v-else>没有找到符合条件的餐厅，试试店名、地址或不同分类。</p>
          <RouterLink class="add-missing" to="/restaurants/new"
            >找不到这家店？添加餐厅 →</RouterLink
          >
          <button type="button" class="primary-action" @click="catalog.resetFilters">
            清除筛选
          </button>
        </div>
        <RouterLink
          v-if="catalog.visibleRestaurants.length"
          class="add-missing"
          to="/restaurants/new"
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
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 手机单列、桌面双列；分类在容器内滚动。 */
.restaurant-directory {
  min-width: 0;
  scroll-margin-top: 24px;
}
.directory-heading,
.directory-links,
.results-toolbar,
.sort-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.directory-heading {
  margin: 12px 0;
}
h2,
h3,
p {
  margin: 0;
}
h2 {
  font-size: 20px;
}
.guide-link {
  font-size: 12px;
  text-decoration: none;
  color: #7b715e;
}
.preview-notice {
  margin: 8px 0 16px;
  color: #8a7c64;
  font-size: 11px;
  line-height: 1.7;
}
.preview-label,
.filter-title,
.directory-filters > .field-label {
  display: none;
}
.directory-layout,
.directory-content,
.directory-filters,
.advanced-filters {
  min-width: 0;
}
.directory-filters {
  display: grid;
  gap: 16px;
}
button,
select {
  font: inherit;
  cursor: pointer;
  min-height: 44px;
}
.search-field {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1.5px solid #f5a013;
  border-radius: 28px;
  padding: 3px 4px 3px 16px;
  background: white;
}
.search-field > span {
  font-size: 28px;
  color: #ef9700;
}
.search-field:focus-within {
  outline: 2px solid #edb044;
  outline-offset: 3px;
}
.search-field input {
  flex: 1;
  min-width: 0;
  width: 100%;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 15px;
  outline: none;
}
.search-submit {
  border: 0;
  border-radius: 24px;
  padding: 8px 24px;
  background: #f59b08;
  color: white;
}
.quick-categories {
  display: flex;
  justify-content: space-around;
  gap: 8px;
}
.quick-categories button {
  display: grid;
  justify-items: center;
  gap: 8px;
  min-width: 0;
  background: none;
  border: 0;
  border-radius: 14px;
  padding: 10px;
  font-size: 14px;
}
.quick-categories button span {
  font-size: 36px;
  line-height: 42px;
}
.quick-categories button[aria-pressed='true'] {
  background: #fff3d6;
  color: #b66a00;
}
.filter-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.filter-controls button {
  flex: 1;
  white-space: nowrap;
  border: 1px solid #e7e9ed;
  border-radius: 24px;
  padding: 8px 12px;
  background: white;
  font-size: 12px;
}
.filter-controls button:disabled {
  color: #8a8e97;
}
.advanced-filters {
  display: none;
  padding: 16px;
  background: #fffaf0;
  border-radius: 16px;
}
.advanced-filters.expanded {
  display: block;
}
.category-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 16px;
  padding: 0;
  border: 0;
}
.category-filter legend {
  font-size: 12px;
  margin-bottom: 10px;
}
.category-filter button,
.tier-filters button {
  padding: 6px 12px;
  border: 1px solid #e8e1d4;
  border-radius: 20px;
  background: white;
  font-size: 12px;
}
.category-filter button[aria-pressed='true'],
.tier-filters button[aria-pressed='true'] {
  border-color: #f0b84a;
  background: #fff3d6;
}
.field-label {
  display: block;
  font-size: 12px;
  margin: 10px 0;
}
select {
  min-width: 0;
  max-width: 100%;
  border: 1px solid #e7e9ed;
  border-radius: 10px;
  padding: 8px;
  background: white;
  font-size: 12px;
}
.closed-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  font-size: 12px;
}
.selected-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
}
.selected-filters span {
  padding: 7px 12px;
  border-radius: 20px;
  background: #fff4df;
  overflow-wrap: anywhere;
}
.selected-filters button {
  border: 0;
  background: none;
  color: #a67420;
  font-size: 12px;
}
.nearby-title {
  margin: 22px 0 14px;
}
.nearby-title small {
  margin-left: 12px;
  font-size: 11px;
  color: #8a8e97;
  font-weight: 400;
}
.tier-filters {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  max-width: 100%;
  padding: 4px 2px;
}
.tier-filters button {
  flex-shrink: 0;
}
.results-toolbar {
  margin: 10px 0 16px;
}
.results-toolbar p,
.sort-field {
  font-size: 12px;
  color: #7d7d82;
}
.restaurant-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.directory-empty {
  display: grid;
  justify-items: center;
  gap: 18px;
  text-align: center;
  padding: 48px 20px;
  border: 1px dashed #e3d8c6;
  border-radius: 18px;
}
.directory-empty p {
  max-width: 440px;
  font-size: 13px;
  line-height: 1.8;
  color: #827459;
}
.catalog-pagination {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 24px 0;
}
.catalog-pagination button {
  padding: 8px 12px;
  border: 1px solid #e6dfd1;
  border-radius: 10px;
  background: white;
  font-size: 12px;
}
.catalog-pagination button[aria-current='page'] {
  background: #f0b53b;
}
@media (max-width: 760px) {
  .restaurant-grid {
    grid-template-columns: 1fr;
  }
  .directory-heading h2 {
    font-size: 16px;
  }
  .directory-links .guide-link:last-child {
    display: none;
  }
  .quick-categories button {
    font-size: 12px;
    padding: 6px 3px;
  }
  .quick-categories button span {
    font-size: 30px;
  }
  .filter-controls {
    gap: 5px;
  }
  .filter-controls button {
    font-size: 10px;
    padding: 8px 6px;
  }
  .nearby-title small {
    display: block;
    margin: 6px 0 0;
  }
  .search-submit {
    padding: 8px 20px;
  }
}
</style>

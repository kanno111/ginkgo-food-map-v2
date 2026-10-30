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

/** 翻页后聚焦结果栏，让键盘与手机用户回到当前页内容。 */
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
          <button
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
        <div class="results-controls">
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
        <div class="preview-notice" role="note">
          <span class="preview-label">餐厅目录</span>
          <p>营业、地址及消费请出发前核实。带“联调模拟”标签的店铺仅供测试，不代表真实经营情况。</p>
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
/* 首页展示样式统一使用暖色、轻边框及紧凑间距。 */
.restaurant-directory {
  min-width: 0;
  scroll-margin-top: 24px;
}
h2,
h3,
p {
  margin: 0;
}
h2 {
  font-size: 20px;
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
  margin: 12px 0 16px;
}
.guide-link {
  color: #858585;
  font-size: 12px;
  text-decoration: none;
}
.guide-link:hover {
  color: #a86506;
}
.preview-notice {
  color: #958977;
  font-size: 11px;
  line-height: 1.7;
  margin-top: 16px;
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
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
}
button,
select {
  font: inherit;
  cursor: pointer;
  min-height: 40px;
}
button:focus-visible,
select:focus-visible,
a:focus-visible {
  outline: 2px solid #f59e0b;
  outline-offset: 3px;
}
.search-field {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 4px 4px 16px;
  border: 1px solid #edc27c;
  border-radius: 12px;
  background: white;
}
.search-field > span {
  color: #d28a20;
  font-size: 24px;
}
.search-field:focus-within {
  outline: 2px solid #f59e0b;
  outline-offset: 2px;
}
.search-field input {
  flex: 1;
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 14px;
  outline: none;
}
.search-submit {
  padding: 8px 24px;
  border: 0;
  border-radius: 9px;
  background: #f59e0b;
  color: #fff;
  font-weight: 700;
}
.quick-categories {
  display: flex;
  gap: 8px;
  min-width: 0;
  overflow-x: auto;
}
.quick-categories button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-shrink: 0;
  border: 1px solid transparent;
  padding: 4px 12px;
  border-radius: 10px;
  background: transparent;
  font-size: 13px;
  color: #746a5e;
}
.quick-categories button span {
  font-size: 21px;
}
.quick-categories button:hover {
  background: #fff4df;
}
.quick-categories button[aria-pressed='true'] {
  background: #fff1d8;
  color: #a5680f;
  border-color: #f1d8ac;
}
.filter-controls button {
  background: white;
  border: 1px solid #f0e9df;
  border-radius: 9px;
  padding: 8px 12px;
  font-size: 12px;
  color: #746a5e;
}
.advanced-filters {
  display: none;
  grid-column: 1 / -1;
  padding: 16px;
  border: 1px solid #f0e9df;
  background: white;
  border-radius: 12px;
}
.advanced-filters.expanded {
  display: block;
}
.category-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 12px;
  border: 0;
  padding: 0;
}
.category-filter legend {
  margin-bottom: 8px;
  font-size: 12px;
  color: #858585;
}
.category-filter button,
.tier-filters button {
  padding: 4px 12px;
  border: 1px solid #f0e9df;
  border-radius: 9px;
  background: white;
  font-size: 12px;
}
.category-filter button[aria-pressed='true'],
.tier-filters button[aria-pressed='true'] {
  background: #fff2dc;
  border-color: #eecb91;
}
.field-label {
  display: block;
  font-size: 12px;
  margin: 8px 0;
}
select {
  min-width: 0;
  max-width: 100%;
  padding: 8px;
  border: 1px solid #f0e9df;
  border-radius: 9px;
  background: white;
  font-size: 12px;
  color: #746a5e;
}
.closed-filter {
  display: flex;
  align-items: center;
  min-height: 44px;
  gap: 8px;
  font-size: 12px;
}
.selected-filters {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
}
.selected-filters span {
  background: #fff2dc;
  padding: 8px 12px;
  border-radius: 8px;
  overflow-wrap: anywhere;
}
.selected-filters button {
  border: 0;
  background: transparent;
  color: #a5680f;
  font-size: 12px;
}
.nearby-title {
  margin: 20px 0 12px;
}
.nearby-title small {
  margin-left: 12px;
  font-size: 11px;
  color: #858585;
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
  margin: 8px 0 12px;
  scroll-margin-top: 16px;
}
.results-toolbar p,
.sort-field {
  font-size: 12px;
  color: #858585;
}
/* 桌面把杯型、数量与排序合为一行，手机按容器宽度自然换行。 */
.results-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.results-controls .results-toolbar {
  margin: 0;
  flex-shrink: 0;
}
.results-controls .tier-filters {
  min-width: 0;
}
.restaurant-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}
.directory-empty {
  display: grid;
  justify-items: center;
  gap: 16px;
  text-align: center;
  padding: 48px 20px;
  border: 1px dashed #e4d9c8;
  border-radius: 16px;
  background: white;
}
.directory-empty p {
  max-width: 440px;
  font-size: 13px;
  line-height: 1.8;
  color: #858585;
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
  border: 1px solid #f0e9df;
  border-radius: 9px;
  background: white;
  font-size: 12px;
}
.catalog-pagination button[aria-current='page'] {
  background: #fff1d8;
  border-color: #edc27c;
  color: #a5680f;
}
@media (max-width: 1000px) {
  .results-controls {
    flex-wrap: wrap;
  }
  .results-controls .results-toolbar {
    width: 100%;
  }
  .restaurant-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
}
@media (max-width: 600px) {
  .directory-heading {
    margin: 8px 0 12px;
  }
  .directory-heading h2 {
    font-size: 18px;
  }
  .directory-links .guide-link:last-child {
    display: none;
  }
  .directory-filters {
    gap: 8px;
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .quick-categories {
    gap: 4px;
  }
  .quick-categories button {
    flex: 0 0 auto;
    white-space: nowrap;
    padding: 4px 6px;
    gap: 4px;
    font-size: 11px;
    min-height: 44px;
  }
  .quick-categories button span {
    font-size: 18px;
  }
  .filter-controls {
    justify-self: end;
  }
  .filter-controls button {
    min-height: 44px;
  }
  .search-submit {
    padding: 8px 16px;
  }
  .restaurant-grid {
    grid-template-columns: 1fr;
  }
  .nearby-title {
    margin: 16px 0 8px;
    font-size: 18px;
  }
  .nearby-title small {
    margin-left: 8px;
    font-size: 10px;
  }
  .tier-filters button,
  select {
    min-height: 44px;
  }
  .results-toolbar {
    gap: 8px;
  }
  .results-toolbar p {
    font-size: 11px;
  }
  .sort-field {
    gap: 4px;
  }
}
</style>

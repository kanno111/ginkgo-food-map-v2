<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useRestaurantCatalog } from '../model/catalog.store'
import { cupTiers } from '../model/catalog.logic'
import CupBadge from './CupBadge.vue'
import RestaurantCard from './RestaurantCard.vue'

const catalog = useRestaurantCatalog()
// 折叠只改变展示，不清除条件；筛选与页码仍由目录状态保留。
const filtersExpanded = ref(false)
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
        <h2 id="directory-title">餐厅目录</h2>
      </div>
      <RouterLink class="guide-link" to="/scoring-guide">杯型评分说明 →</RouterLink>
    </div>
    <div class="preview-notice" role="note">
      <span class="preview-label">目录预览</span>
      <p>以下为原版 25 家候选店铺，仅供界面预览。营业、地址及人均尚未核实，暂无真实评价。</p>
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
          />
        </div>
        <button
          class="mobile-filter-toggle"
          type="button"
          :aria-expanded="filtersExpanded"
          aria-controls="advanced-filters"
          @click="filtersExpanded = !filtersExpanded"
        >
          {{ filtersExpanded ? '收起筛选' : '更多筛选'
          }}<span v-if="advancedCount">（已选 {{ advancedCount }} 项）</span>
          <span aria-hidden="true">{{ filtersExpanded ? ' −' : ' +' }}</span>
        </button>
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
              :key="category"
              type="button"
              :aria-pressed="catalog.filters.category === category"
              @click="catalog.filters.category = category"
            >
              {{ category }}
            </button>
          </fieldset>
          <label class="field-label" for="restaurant-view">只看这些</label>
          <select id="restaurant-view" v-model="catalog.filters.view">
            <option value="all">全部餐厅</option>
            <option value="recommended">推荐 · 大杯及以上</option>
            <option value="pitfall">踩雷 · 小杯</option>
          </select>
          <label class="closed-filter"
            ><input
              v-model="catalog.filters.hideClosed"
              type="checkbox"
            />隐藏原版标注停业的店</label
          >
        </div>
      </aside>
      <div class="directory-content">
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
            找到 <strong>{{ catalog.results.length }}</strong> 家候选店铺<span
              v-if="catalog.results.length"
            >
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
        <div v-if="catalog.results.length" class="restaurant-grid">
          <RestaurantCard
            v-for="restaurant in catalog.visibleRestaurants"
            :key="restaurant.id"
            :restaurant="restaurant"
          />
        </div>
        <div v-else class="directory-empty" role="status">
          <CupBadge tier="none" />
          <h3>换个条件，也许就遇见了。</h3>
          <p
            v-if="
              catalog.filters.view !== 'all' ||
              catalog.filters.tiers.some((tier) => tier !== 'none')
            "
          >
            候选目录暂无真实评价，所有店铺均为待评级。试试“全部杯型”或其他关键词。
          </p>
          <p v-else>没有找到符合条件的候选店铺，试试店名、地址或不同分类。</p>
          <button type="button" class="primary-action" @click="catalog.resetFilters">
            清除筛选
          </button>
        </div>
        <nav v-if="catalog.pages > 1" class="catalog-pagination" aria-label="餐厅分页">
          <button
            type="button"
            :disabled="catalog.page === 1"
            @click="changePage(catalog.page - 1)"
          >
            ← 上一页
          </button>
          <button
            v-for="page in catalog.pages"
            :key="page"
            type="button"
            :aria-current="catalog.page === page ? 'page' : undefined"
            :aria-label="`第 ${page} 页`"
            @click="changePage(page)"
          >
            {{ page }}
          </button>
          <button
            type="button"
            :disabled="catalog.page === catalog.pages"
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
.restaurant-directory {
  scroll-margin-top: 24px;
}
.directory-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 14px;
}
h2 {
  margin: 0;
  font-family: Georgia, 'Songti SC', serif;
  font-size: 22px;
  font-weight: 600;
}
.guide-link {
  color: #786846;
  font-size: 12px;
  text-decoration: none;
  white-space: nowrap;
}
.preview-notice {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 10px 14px;
  margin-bottom: 16px;
  border: 1px solid #e9dbb5;
  border-radius: 12px;
  background: #f7f0df;
}
.preview-label {
  flex-shrink: 0;
  color: #826126;
  font-size: 12px;
  font-weight: 800;
}
.preview-notice p {
  margin: 0;
  font-size: 12px;
  line-height: 1.8;
  color: #7a6d51;
}
.directory-layout {
  display: grid;
  grid-template-columns: 218px minmax(0, 1fr);
  gap: 34px;
  align-items: start;
}
.directory-filters {
  padding: 22px 20px;
  background: #f2ece0;
  border: 1px solid #e8dfcd;
  border-radius: 18px;
}
.filter-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.filter-title h3 {
  margin: 0;
  font-size: 14px;
}
button {
  cursor: pointer;
  font: inherit;
  min-height: 44px;
}
.mobile-filter-toggle {
  display: none;
}
.filter-title button {
  border: 0;
  background: none;
  color: #867b66;
  font-size: 12px;
  padding: 5px 0 5px 8px;
}
.field-label {
  display: block;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 700;
  color: #7f735e;
}
.search-field {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px;
  border: 1px solid #ded5c4;
  border-radius: 9px;
  background: #fffdf8;
}
.search-field > span {
  color: #8c806a;
  font-size: 22px;
  line-height: 20px;
}
input[type='search'] {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: #2b2a26;
  font: inherit;
  font-size: 12px;
  outline: none;
}
.search-field:focus-within {
  outline: 2px solid #ad7c22;
  outline-offset: 2px;
}
fieldset {
  padding: 0;
  border: 0;
  margin: 26px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
legend {
  margin-bottom: 12px;
  font-size: 12px;
  font-weight: 700;
  color: #7f735e;
}
.category-filter button {
  padding: 7px 10px;
  border: 1px solid #e0d5bf;
  border-radius: 7px;
  background: transparent;
  color: #7a705e;
  font-size: 12px;
}
.category-filter button[aria-pressed='true'] {
  color: #fffdf8;
  border-color: #33372e;
  background: #33372e;
}
select {
  width: 100%;
  min-height: 44px;
  min-width: 0;
  padding: 10px;
  border: 1px solid #ddd3bf;
  border-radius: 9px;
  background: #fffdf8;
  font: inherit;
  font-size: 12px;
  color: #625841;
}
.closed-filter {
  display: flex;
  align-items: center;
  min-height: 44px;
  gap: 6px;
  margin-top: 18px;
  font-size: 12px;
  line-height: 1.7;
  color: #796e5a;
}
.closed-filter input {
  margin: 2px 0 0;
  accent-color: #676b49;
}
.directory-content {
  min-width: 0;
}
.tier-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.tier-filters button {
  padding: 5px;
  border: 1px solid #e3dbcc;
  border-radius: 999px;
  background: transparent;
  font-size: 12px;
  color: #7b705b;
}
.tier-filters button[aria-pressed='true'] {
  outline: 2px solid #8a6c26;
  outline-offset: 1px;
  border-color: #c9b47d;
  background: #ede3c9;
  color: #6c541b;
}
.results-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin: 16px 0;
  scroll-margin-top: 16px;
}
.results-toolbar p {
  margin: 0;
  font-size: 12px;
  color: #796a51;
}
.results-toolbar strong {
  color: #413a2d;
  font-size: 14px;
}
.sort-field {
  display: flex;
  align-items: center;
  gap: 9px;
}
.sort-field label {
  white-space: nowrap;
  font-size: 12px;
  color: #796a51;
}
.sort-field select {
  width: 130px;
  padding: 7px 9px;
  background: transparent;
}
.restaurant-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.directory-empty {
  display: grid;
  justify-items: center;
  padding: 64px 24px;
  border: 1px dashed #d9ceba;
  border-radius: 20px;
  text-align: center;
}
.directory-empty h3 {
  margin: 22px 0 0;
  font-family: Georgia, 'Songti SC', serif;
  font-size: 25px;
}
.directory-empty p {
  max-width: 440px;
  margin: 14px 0 24px;
  color: #81745c;
  font-size: 13px;
  line-height: 1.8;
}
.catalog-pagination {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 32px;
}
.catalog-pagination button {
  display: block;
  padding: 8px 11px;
  border: 1px solid #ded4c1;
  border-radius: 8px;
  background: transparent;
  font-size: 12px;
  color: #7c6f57;
}
.catalog-pagination button[aria-current='page'] {
  background: #33372e;
  border-color: #33372e;
  color: white;
}
@media (max-width: 1000px) {
  .directory-layout {
    grid-template-columns: 190px minmax(0, 1fr);
    gap: 22px;
  }
  .restaurant-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 700px) {
  .directory-layout {
    grid-template-columns: 1fr;
  }
  .directory-filters {
    padding: 10px 12px;
  }
  .filter-title {
    margin-bottom: 0;
  }
  .filter-title h3,
  .directory-filters > .field-label {
    display: none;
  }
  .directory-filters {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 44px;
    gap: 0 10px;
  }
  .filter-title {
    grid-column: 2;
    grid-row: 1;
  }
  .search-field {
    grid-column: 1;
    grid-row: 1;
    min-height: 44px;
  }
  .mobile-filter-toggle,
  .advanced-filters {
    grid-column: 1 / -1;
  }
  .mobile-filter-toggle {
    display: block;
    padding: 6px 0;
    border: 0;
    background: none;
    font-size: 12px;
    color: #625841;
  }
  .advanced-filters {
    display: none;
  }
  .advanced-filters.expanded {
    display: block;
  }
  fieldset {
    margin: 20px 0;
  }
  .directory-heading {
    align-items: center;
    gap: 12px;
  }
  .preview-notice {
    align-items: flex-start;
    gap: 10px;
  }
  .results-toolbar {
    align-items: flex-start;
  }
  .guide-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
  .tier-filters {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding: 3px;
    margin: -3px;
  }
  .tier-filters button {
    flex: 0 0 auto;
  }
  .directory-layout {
    gap: 14px;
  }
}
</style>

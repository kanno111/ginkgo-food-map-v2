<script setup lang="ts">
import { useRestaurantCatalog } from '../model/catalog.store'
import type { RestaurantSort } from '../model/restaurant.types'
import RestaurantAdvancedFilters from './RestaurantAdvancedFilters.vue'

/** 分类、排序与经营状态直接操作同一份目录状态，由store统一重置页码并查询。 */
const catalog = useRestaurantCatalog()
const sortGroups: { label: string; options: { key: RestaurantSort; label: string }[] }[] = [
  {
    label: '常用排序',
    options: [
      { key: 'score', label: '综合评分' },
      { key: 'distance', label: '离校区最近' },
      { key: 'price', label: '人均从低到高' },
      { key: 'reviews', label: '点评最多' },
    ],
  },
  {
    label: '单项评分排序',
    options: [
      { key: 'taste', label: '味道优先' },
      { key: 'value', label: '性价比优先' },
      { key: 'ambience', label: '环境优先' },
      { key: 'service', label: '服务优先' },
    ],
  },
]
// 分类、排序和经营状态不生成重复标签；仅高级价格/距离条件展示可移除标签。
</script>

<template>
  <div class="catalog-filters">
    <form class="search-field" role="search" @submit.prevent="catalog.load">
      <span aria-hidden="true">⌕</span>
      <input
        v-model="catalog.filters.keyword"
        aria-label="搜索餐厅"
        placeholder="店名、地址、标签…"
        maxlength="100"
        type="search"
      />
      <button type="submit">搜索</button>
    </form>
    <nav class="quick-categories" aria-label="美食快捷分类">
      <button
        type="button"
        :aria-pressed="!catalog.filters.category"
        @click="catalog.filters.category = ''"
      >
        全部美食
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
    </nav>
    <div class="filter-toolbar" role="group" aria-label="排序与经营状态">
      <div class="sort-control">
        <!-- 原生分组单选框负责键盘导航、选中回显及关闭行为，避免再维护一套排序草稿。 -->
        <select v-model="catalog.filters.sort" aria-label="排序方式">
          <optgroup v-for="group in sortGroups" :key="group.label" :label="group.label">
            <option v-for="sort in group.options" :key="sort.key" :value="sort.key">
              {{ sort.label }}
            </option>
          </optgroup>
        </select>
      </div>
      <button
        class="hide-closed"
        type="button"
        :aria-pressed="catalog.filters.hideClosed"
        @click="catalog.filters.hideClosed = !catalog.filters.hideClosed"
      >
        <span class="status-check" aria-hidden="true">{{
          catalog.filters.hideClosed ? '✓' : ''
        }}</span>
        隐藏停业餐厅
      </button>
      <RestaurantAdvancedFilters />
    </div>
    <div
      v-if="catalog.filters.maxPrice !== null || catalog.filters.maxDistanceMeters !== null"
      class="advanced-tags"
      aria-label="已应用的高级筛选"
    >
      <button
        v-if="catalog.filters.maxPrice !== null"
        type="button"
        :aria-label="`移除人均${catalog.filters.maxPrice}元以下筛选`"
        @click="catalog.filters.maxPrice = null"
      >
        人均 ≤ {{ catalog.filters.maxPrice }}元 <span aria-hidden="true">×</span>
      </button>
      <button
        v-if="catalog.filters.maxDistanceMeters !== null"
        type="button"
        :aria-label="`移除直线距离${catalog.filters.maxDistanceMeters}米以内筛选`"
        @click="catalog.filters.maxDistanceMeters = null"
      >
        直线距离 ≤ {{ catalog.filters.maxDistanceMeters }}米 <span aria-hidden="true">×</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 高频操作保持两行：分类横向滚动，排序和停业标记轻量并列，不增加重复容器。 */
.catalog-filters {
  margin: 15px 0 12px;
  min-width: 0;
}
button,
input,
select {
  font: inherit;
}
button,
select {
  cursor: pointer;
}
button:focus-visible,
select:focus-visible {
  outline: 2px solid #f59e0b;
  outline-offset: 3px;
}
.search-field {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px;
  border: 1px solid #efc17c;
  border-radius: 12px;
  background: white;
}
.search-field > span {
  margin-left: 10px;
  color: #d68b16;
}
.search-field input {
  flex: 1;
  min-width: 0;
  padding: 9px 0;
  border: 0;
  background: transparent;
}
.search-field button {
  border: 0;
  border-radius: 9px;
  background: #f59e0b;
  color: white;
  padding: 10px 25px;
}
.quick-categories {
  display: flex;
  gap: 24px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  padding: 10px 2px 4px;
}
.quick-categories button {
  flex-shrink: 0;
  min-height: 44px;
  border: 0;
  border-bottom: 3px solid transparent;
  padding: 6px 0;
  background: transparent;
  color: #38332b;
  white-space: nowrap;
}
.quick-categories button:hover {
  color: #a36508;
}
.quick-categories button[aria-pressed='true'] {
  border-color: #f59e0b;
  color: #9b6006;
  font-weight: bold;
}
.filter-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 5px;
}
.sort-control {
  position: relative;
  flex-shrink: 0;
}
.sort-control::after {
  content: '';
  position: absolute;
  top: 17px;
  right: 13px;
  width: 6px;
  height: 6px;
  border-right: 1.5px solid #817667;
  border-bottom: 1.5px solid #817667;
  transform: rotate(45deg);
  pointer-events: none;
}
.sort-control select,
.hide-closed {
  min-height: 44px;
  box-sizing: border-box;
  border: 1px solid #e9e2d7;
  border-radius: 8px;
  background: #fff;
  color: #4d463c;
  font-size: 13px;
}
.sort-control select {
  appearance: none;
  width: 156px;
  padding: 9px 32px 9px 12px;
}
.hide-closed {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px 12px;
  white-space: nowrap;
}
.sort-control select:hover,
.hide-closed:hover {
  border-color: #d5b78a;
}
.status-check {
  display: inline-grid;
  place-items: center;
  width: 14px;
  height: 14px;
  box-sizing: border-box;
  border: 1px solid #c9c1b4;
  border-radius: 3px;
  font-size: 11px;
  line-height: 1;
}
.hide-closed[aria-pressed='true'] {
  background: #fff2dc;
  border-color: #edc78a;
  color: #9b6006;
}
.hide-closed[aria-pressed='true'] .status-check {
  border-color: #bd7a16;
  background: #bd7a16;
  color: white;
}
.advanced-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.advanced-tags button {
  border: 1px solid #eddbbb;
  border-radius: 6px;
  padding: 5px 9px;
  background: #fff3df;
  color: #925e13;
  font-size: 12px;
}
@media (max-width: 640px) {
  .quick-categories {
    gap: 21px;
  }
  .filter-toolbar {
    gap: 8px;
  }
  .sort-control select {
    width: 112px;
    font-size: 12px;
    padding: 9px 20px 9px 6px;
  }
  .hide-closed {
    padding: 9px 6px;
    gap: 4px;
    font-size: 12px;
  }
  .filter-toolbar {
    gap: 5px;
  }
  .sort-control::after {
    right: 9px;
  }
}
</style>

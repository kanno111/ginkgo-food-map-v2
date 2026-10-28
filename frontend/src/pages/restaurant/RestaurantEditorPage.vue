<script setup lang="ts">
import { RestaurantEditor } from '@/modules/restaurant'

// 新增/编辑共享表单，路由参数改变时重建局部草稿，不能串用另一家店的字段。
defineProps<{ id?: string }>()
</script>

<template><RestaurantEditor :id="id" :key="id ?? 'new'" /></template>

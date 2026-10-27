<script setup lang="ts">
import DefaultLayout from './layouts/DefaultLayout.vue'
import { onMounted } from 'vue'
import { useLoginStore } from '@/modules/auth'

const auth = useLoginStore()
// 启动时向服务端校验凭证，不能仅凭本地存储就展示为已登录。
onMounted(() => {
  void auth.restore()
})
</script>

<template>
  <DefaultLayout />
</template>

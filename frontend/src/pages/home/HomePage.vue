<script setup lang="ts">
import { SystemStatus } from '@/modules/system'

const capabilities = [
  { title: 'MySQL', text: '保存用户、店铺和评价等核心业务数据。' },
  { title: 'Redis', text: '承载登录状态、验证码和热点数据缓存。' },
  { title: '模块化单体', text: '先把边界做清楚，再按真实压力拆分服务。' },
]
</script>

<template>
  <div class="home-page">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">UESTC · CHENGDU FOOD GUIDE</p>
        <h1>认真吃饭，<br /><span>认真记录。</span></h1>
        <p class="summary">
          使用电子科技大学学生邮箱创建账号并登录。地图、店铺和评价功能会继续逐步开放。
        </p>
        <div class="hero-actions">
          <RouterLink class="primary-action" to="/register">注册账号</RouterLink>
          <RouterLink to="/login">登录账号</RouterLink>
        </div>
      </div>

      <aside class="hero-card" aria-label="项目当前状态">
        <span class="cup">杯</span>
        <p>当前阶段</p>
        <strong>注册与账号登录</strong>
        <small>只向电子科技大学学生开放</small>
      </aside>
    </section>

    <SystemStatus />

    <section id="migration" class="capability-section">
      <div class="section-heading">
        <p class="eyebrow">ARCHITECTURE</p>
        <h2>轻量，但不是玩具架构</h2>
      </div>
      <div class="capability-grid">
        <article v-for="item in capabilities" :key="item.title">
          <h3>{{ item.title }}</h3>
          <p>{{ item.text }}</p>
        </article>
      </div>
    </section>
  </div>
</template>

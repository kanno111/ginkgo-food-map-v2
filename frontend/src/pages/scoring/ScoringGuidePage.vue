<script setup lang="ts">
import { CupBadge, cupTiers, ratingDimensions } from '@/modules/restaurant'
</script>

<template>
  <article class="scoring-guide" aria-labelledby="guide-title">
    <RouterLink class="guide-back" to="/">← 返回餐厅目录</RouterLink>
    <header class="guide-heading">
      <p class="eyebrow">THE GINKGO SCALE</p>
      <h1 id="guide-title">一口一杯，认真评价。</h1>
      <p>没有标准答案，只有真实体验。<br />把一餐的感受，分成四个维度慢慢说。</p>
    </header>
    <section class="dimension-guide" aria-label="四维评分">
      <div v-for="(dimension, index) in ratingDimensions" :key="dimension.key">
        <span>0{{ index + 1 }}</span>
        <h2>{{ dimension.label }}</h2>
        <p>{{ dimension.description }}</p>
      </div>
    </section>
    <section class="tier-guide" aria-labelledby="tiers-title">
      <h2 id="tiers-title">五档杯型，和一份等待。</h2>
      <p>每项 0–10 分，步进 0.5。杯型由真实评价的综合分计算。</p>
      <div class="guide-table">
        <div v-for="tier in cupTiers" :key="tier.key" class="tier-row">
          <CupBadge :tier="tier.key" /><span v-if="tier.key === 'bucket'">8.6 ≤ 分数 ≤ 10</span
          ><span v-else-if="tier.key === 'super'">7.4 ≤ 分数 &lt; 8.6</span
          ><span v-else-if="tier.key === 'large'">6.2 ≤ 分数 &lt; 7.4</span
          ><span v-else-if="tier.key === 'medium'">5.0 ≤ 分数 &lt; 6.2</span
          ><span v-else-if="tier.key === 'small'">0 ≤ 分数 &lt; 5.0</span
          ><span v-else>没有有效评价</span><span>{{ tier.description }}</span>
        </div>
      </div>
    </section>
    <section class="calculation-guide" aria-labelledby="calculation-title">
      <h2 id="calculation-title">杯型怎么算出来？</h2>
      <ol>
        <li>单条评价总分 = 四项评分的平均值，四舍五入保留两位小数。</li>
        <li>餐厅综合分 = 全部有效评价总分的平均值，展示时保留一位小数。</li>
        <li>杯型使用尚未四舍五入的餐厅综合分判断：8.55 即使显示为 8.6，仍是超大杯。</li>
        <li>推荐率单独计算，等于推荐评价数除以有效评价总数，与杯型是不同指标。</li>
      </ol>
      <p>0 分是有效评分；没有评价则是“待评级”。只有一条评价的高分，也请结合评价数量和正文判断。</p>
    </section>
    <section class="community-note">
      <span aria-hidden="true">✳</span>
      <h2>分享体验，也保留善意。</h2>
      <p>
        只评价自己真正吃过的餐厅，写下菜品、消费和具体感受。<br />不刷分、不发广告，不发布他人隐私或人身攻击。
      </p>
      <RouterLink class="primary-action" to="/">回去找点好吃的 ↗</RouterLink>
    </section>
  </article>
</template>

<style scoped>
.scoring-guide {
  width: min(900px, calc(100% - 40px));
  margin: 0 auto;
  padding: 35px 0 80px;
}
.guide-back {
  font-size: 12px;
  color: #887550;
  text-decoration: none;
}
.guide-heading {
  padding: 44px 0;
  text-align: center;
}
h1 {
  margin: 20px 0;
  font-family: Georgia, 'Songti SC', serif;
  font-size: clamp(32px, 5vw, 52px);
  font-weight: 500;
}
.guide-heading > p:last-child {
  color: #8b7b60;
  line-height: 1.9;
  font-size: 14px;
}
.dimension-guide {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.dimension-guide > div {
  padding: 24px;
  border-radius: 16px;
  background: #efecdf;
}
.dimension-guide span {
  color: #ac9d7d;
  font-family: Georgia, serif;
  font-size: 22px;
}
h2 {
  font-size: 20px;
  font-weight: 500;
}
.dimension-guide h2 {
  font-size: 16px;
  margin: 20px 0 10px;
}
.dimension-guide p {
  margin: 0;
  color: #8a7a5d;
  font-size: 12px;
  line-height: 1.9;
}
.tier-guide {
  margin-top: 50px;
}
.tier-guide > h2,
.calculation-guide h2 {
  font-family: Georgia, 'Songti SC', serif;
  font-size: 28px;
}
.tier-guide > p {
  color: #8c7b60;
  font-size: 13px;
  line-height: 1.8;
}
.guide-table {
  margin-top: 24px;
  border: 1px solid #e1d7c5;
  border-radius: 16px;
  overflow: hidden;
}
.tier-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
  align-items: center;
  padding: 15px 24px;
  border-bottom: 1px solid #e7decc;
}
.tier-row:last-child {
  border-bottom: 0;
}
.tier-row > span:not(.cup-badge) {
  color: #8a7a60;
  font-size: 12px;
}
.calculation-guide {
  padding: 28px;
  margin-top: 38px;
  border-radius: 16px;
  background: #e9ecdf;
}
.calculation-guide h2 {
  margin: 0 0 20px;
}
ol {
  padding-left: 20px;
  margin: 0;
}
li,
.calculation-guide > p {
  color: #737b61;
  font-size: 13px;
  line-height: 2;
}
.community-note {
  text-align: center;
  margin-top: 45px;
  padding: 30px 0;
}
.community-note > span {
  color: #989562;
  font-size: 40px;
}
.community-note h2 {
  font-family: Georgia, 'Songti SC', serif;
  font-size: 30px;
}
.community-note p {
  color: #7e6a4d;
  font-size: 13px;
  line-height: 1.9;
  margin-bottom: 28px;
}
.community-note a {
  background: #343a2d;
  border-radius: 10px;
  font-size: 12px;
}
@media (max-width: 700px) {
  .scoring-guide {
    width: calc(100% - 28px);
  }
  .dimension-guide {
    grid-template-columns: repeat(2, 1fr);
  }
  .dimension-guide > div {
    padding: 20px;
  }
  .tier-row {
    grid-template-columns: 1fr 1fr;
    gap: 9px;
    padding: 14px 18px;
  }
  .tier-row > span:last-child {
    grid-column: 1 / -1;
    padding-left: 6px;
  }
}
</style>

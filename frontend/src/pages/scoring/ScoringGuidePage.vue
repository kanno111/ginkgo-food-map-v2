<script setup lang="ts">
import { ratingDimensions } from '@/modules/restaurant'
import cover from '@/shared/assets/ginkgo-cover.jpg'
</script>

<template>
  <article class="scoring-guide" aria-labelledby="guide-title">
    <RouterLink class="guide-back" to="/">← 返回餐厅目录</RouterLink>
    <header class="guide-heading">
      <h1 id="guide-title">评分说明</h1>
      <p>记录真实用餐体验，评分请结合参与人数和具体点评参考。</p>
    </header>
    <section class="dimension-guide" aria-label="四维评分">
      <div v-for="(dimension, index) in ratingDimensions" :key="dimension.key">
        <span>0{{ index + 1 }}</span>
        <h2>{{ dimension.label }}</h2>
        <p>{{ dimension.description }}</p>
      </div>
    </section>
    <section class="calculation-guide" aria-labelledby="calculation-title">
      <h2 id="calculation-title">评分怎么算出来？</h2>
      <ol>
        <li>单条评价总分 = 四项评分的平均值，四舍五入保留两位小数。</li>
        <li>
          每个账号对同一家店只取最新有效点评。餐厅综合分为这些点评总分的平均值，展示一位小数。
        </li>
        <li>四维分别对每位同学最新有效点评中的对应维度求平均，历史点评不重复计分。</li>
        <li>推荐率单独计算，等于最新有效点评中推荐人数除以评分人数，与综合分独立。</li>
      </ol>
      <p>
        0 分是有效评分；没有评价则显示“暂无评分”。只有一条评价的高分，也请结合评分人数和正文判断。
      </p>
    </section>
    <section class="community-note">
      <!-- 与原版帮助页共用封面和社团说明，避免另造品牌口号。 -->
      <img
        :src="cover"
        width="140"
        height="140"
        loading="lazy"
        alt="社团封面：白色兔子举着「辣鸡！」的牌子"
      />
      <p>
        这张封面是社团的传家宝：<b>吃到难吃的，就举牌子。</b
        ><br />本榜单是社团内部测评，不是商业榜单，也不接推广。
      </p>
      <RouterLink class="primary-action" to="/">返回餐厅目录</RouterLink>
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
.community-note img {
  border-radius: 12px;
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
}
</style>

<script setup lang="ts">
import { CupBadge, RestaurantCatalog, cupTiers } from '@/modules/restaurant'
import cover from '@/shared/assets/ginkgo-cover.jpg'

// 封面从原版 _cover.b64.txt 无损解码，标语保留原文；仅调整布局以更早显示目录。
</script>

<template>
  <div class="discovery-page">
    <section class="discovery-hero" aria-labelledby="discovery-title">
      <div class="discovery-copy">
        <p class="eyebrow">UNIVERSITY OF ELECTRONIC SCIENCE AND TECHNOLOGY OF CHINA</p>
        <h1 id="discovery-title">Ginkgo 美食地图</h1>
        <p class="hero-description">
          电子科技大学 Ginkgo 烹饪社 · 成都觅食指南。吃了就打分，按杯型论英雄——不好吃就举牌子。
        </p>
        <div class="discovery-actions">
          <a href="#restaurant-directory" class="primary-action">浏览餐厅</a>
          <RouterLink to="/scoring-guide">评分说明 →</RouterLink>
        </div>
      </div>
      <figure class="hero-cover">
        <img
          :src="cover"
          width="300"
          height="300"
          alt="Ginkgo 烹饪社封面：一只白色兔子举着「辣鸡！」的牌子"
          fetchpriority="high"
        />
        <figcaption>不好吃，就举牌子。</figcaption>
      </figure>
    </section>
    <RestaurantCatalog />
    <section class="scoring-invitation" aria-labelledby="cup-invitation-title">
      <div>
        <h2 id="cup-invitation-title">按杯型论英雄</h2>
        <p>味道、性价比、服务、环境 · 四维评分</p>
      </div>
      <div class="invitation-cups">
        <div v-for="tier in cupTiers.slice(0, 5)" :key="tier.key">
          <CupBadge :tier="tier.key" /><small>{{ tier.description }}</small>
        </div>
      </div>
      <RouterLink to="/scoring-guide">查看评分说明 →</RouterLink>
    </section>
    <footer class="discovery-footer">
      <span>电子科技大学 Ginkgo 烹饪社</span><span>不好吃，就举牌子。</span>
    </footer>
  </div>
</template>

<style scoped>
.discovery-page {
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
}
.discovery-hero {
  display: grid;
  grid-template-columns: 1fr 160px;
  gap: 36px;
  align-items: center;
  padding: 24px 0;
}
.eyebrow {
  font-size: 10px;
  letter-spacing: 0.08em;
}
h1 {
  margin: 12px 0;
  font-size: clamp(26px, 3.4vw, 42px);
  line-height: 1.2;
}
.hero-description {
  max-width: 720px;
  color: #75664f;
  font-size: 13px;
  line-height: 1.8;
  margin: 0;
}
.discovery-actions {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 16px;
}
.discovery-actions a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  font-size: 12px;
  text-decoration: none;
}
.discovery-actions .primary-action {
  border-radius: 10px;
  background: #e9b949;
  color: #2b2a26;
}
.hero-cover {
  margin: 0;
  text-align: center;
}
.hero-cover img {
  display: block;
  width: 140px;
  height: 140px;
  margin: 0 auto;
  border-radius: 12px;
}
figcaption {
  margin-top: 8px;
  color: #75664f;
  font-size: 12px;
}
.scoring-invitation {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 24px;
  margin: 36px 0;
  background: #f2ebd9;
  border: 1px solid #e3d7bb;
  border-radius: 16px;
}
.scoring-invitation h2 {
  font-size: 20px;
  margin: 0 0 10px;
}
.scoring-invitation p,
.scoring-invitation > a {
  font-size: 12px;
  color: #7c694e;
}
.scoring-invitation > a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}
.invitation-cups {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.invitation-cups > div {
  display: grid;
  gap: 8px;
  justify-items: center;
}
.invitation-cups small {
  color: #75664f;
  font-size: 12px;
}
.discovery-footer {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 0 32px;
  border-top: 1px solid #ded7c9;
  color: #7a6c54;
  font-size: 12px;
}
@media (max-width: 700px) {
  .discovery-page {
    width: calc(100% - 28px);
  }
  .discovery-hero {
    grid-template-columns: minmax(0, 1fr) 82px;
    gap: 12px;
    padding: 16px 0;
  }
  .eyebrow {
    display: none;
  }
  h1 {
    margin: 0 0 10px;
    font-size: 24px;
  }
  .hero-description {
    font-size: 12px;
    line-height: 1.7;
  }
  .hero-cover {
    align-self: start;
  }
  .hero-cover img {
    width: 82px;
    height: 82px;
  }
  figcaption {
    font-size: 10px;
    line-height: 1.6;
    margin-inline: -10px;
  }
  .discovery-actions {
    margin-top: 10px;
    gap: 12px;
  }
  .discovery-actions .primary-action {
    padding: 10px 14px;
  }
  .scoring-invitation {
    padding: 20px;
    gap: 16px;
  }
  .discovery-footer {
    flex-wrap: wrap;
  }
}
</style>

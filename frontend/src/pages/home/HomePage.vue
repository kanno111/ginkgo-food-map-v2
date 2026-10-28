<script setup lang="ts">
import { CupBadge, RestaurantCatalog, cupTiers } from '@/modules/restaurant'
</script>

<template>
  <div class="discovery-page">
    <section class="discovery-hero" aria-labelledby="discovery-title">
      <div class="discovery-copy">
        <p class="eyebrow">UESTC · CHENGDU · GOOD FOOD</p>
        <h1 id="discovery-title">认真吃饭。<br />把好味道<span>留下来。</span></h1>
        <p class="hero-description">
          从清水河的一顿日常，到成都街巷里的小惊喜。<br />和 Ginkgo 一起，慢慢找到值得再去的那家店。
        </p>
        <div class="discovery-actions">
          <a href="#restaurant-directory" class="primary-action">去找下一顿 ↗</a
          ><RouterLink to="/scoring-guide">认识我们的杯型评分 →</RouterLink>
        </div>
        <p class="hero-signature">
          <span aria-hidden="true">✳</span> 一口一杯，记录自己的真实体验。
        </p>
      </div>
      <aside class="cup-story" aria-label="Ginkgo 杯型评分介绍">
        <div class="story-top"><span>THE GINKGO SCALE</span><span>一口一杯</span></div>
        <div class="story-art" aria-hidden="true">
          <svg class="story-cup cup-back" viewBox="0 0 120 150" fill="none">
            <path d="m20 48 12 85h57l12-85H20Z" fill="#c9c3a7" stroke="#71785b" stroke-width="2" />
            <path
              d="M13 48h96M25 35h71M70 35l12-25"
              stroke="#71785b"
              stroke-width="3"
              stroke-linecap="round"
            />
          </svg>
          <svg class="story-cup cup-front" viewBox="0 0 120 150" fill="none">
            <path d="m20 48 12 85h57l12-85H20Z" fill="#ebba52" stroke="#4d5139" stroke-width="2" />
            <path
              d="M13 48h96M25 35h71M70 35l12-25"
              stroke="#4d5139"
              stroke-width="3"
              stroke-linecap="round"
            />
            <path
              d="M48 74c20-11 34 2 23 18-11 15-25 9-26 0-1-8 8-15 17-10"
              stroke="#4d5139"
              stroke-width="3"
              stroke-linecap="round"
            />
          </svg>
          <span class="art-spark spark-one">✳</span><span class="art-spark spark-two">+</span
          ><span class="art-caption">一口一杯。<br />好好吃饭。</span>
        </div>
        <div class="story-bottom">
          <p>每一份用餐感受，<br /><strong>都值得被认真记录。</strong></p>
          <span class="story-stamp">GINKGO<br />FOOD CLUB</span>
        </div>
      </aside>
    </section>
    <div class="discovery-divider">
      <span>成都的味道，慢慢发现</span><span>FROM CAMPUS TO THE CITY ↘</span>
    </div>
    <RestaurantCatalog />
    <section class="scoring-invitation" aria-labelledby="cup-invitation-title">
      <div>
        <p class="eyebrow">A CUP FOR EVERY EXPERIENCE</p>
        <h2 id="cup-invitation-title">分数有依据，杯型有温度。</h2>
        <p>味道、性价比、服务、环境。四个维度，留下每一餐的真实感受。</p>
      </div>
      <div class="invitation-cups">
        <CupBadge v-for="tier in cupTiers.slice(0, 5)" :key="tier.key" :tier="tier.key" />
      </div>
      <RouterLink to="/scoring-guide">查看评分说明 →</RouterLink>
    </section>
    <footer class="discovery-footer">
      <span>GINKGO 烹饪社 · 电子科技大学</span><span>认真吃饭，友善分享。</span>
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
  grid-template-columns: 1.3fr 1fr;
  gap: 68px;
  padding: 66px 0 55px;
  align-items: center;
}
.discovery-copy > .eyebrow {
  font-size: 12px;
}
h1 {
  margin: 24px 0;
  font-family: Georgia, 'Songti SC', serif;
  font-size: clamp(42px, 5.1vw, 66px);
  font-weight: 600;
  letter-spacing: -0.06em;
  line-height: 1.2;
}
h1 span {
  color: #a57a2b;
}
.hero-description {
  color: #75664f;
  font-size: 13px;
  line-height: 2;
}
.discovery-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 23px;
  margin-top: 28px;
}
.discovery-actions .primary-action {
  border-radius: 10px;
  background: #343a2d;
  font-size: 12px;
}
.discovery-actions > a:not(.primary-action) {
  color: #7d715a;
  font-size: 12px;
  text-decoration: none;
}
.hero-signature {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 25px;
  color: #796b53;
  font-size: 12px;
}
.hero-signature span {
  color: #96915e;
  font-size: 22px;
}
.cup-story {
  position: relative;
  min-width: 0;
  padding: 23px;
  border: 1px solid #d6d7be;
  border-radius: 22px;
  background: #e9e9d9;
  box-shadow: 9px 9px 0 #f0e9d9;
  transform: rotate(1deg);
}
.story-top {
  display: flex;
  justify-content: space-between;
  color: #5b6145;
  font-size: 9px;
  letter-spacing: 0.13em;
}
.story-art {
  position: relative;
  height: 228px;
}
.story-cup {
  position: absolute;
  width: 136px;
  height: 170px;
}
.cup-back {
  left: 13%;
  top: 16px;
  transform: rotate(-18deg);
}
.cup-front {
  left: 35%;
  top: 42px;
  transform: rotate(13deg);
}
.art-spark {
  position: absolute;
  color: #7b835b;
}
.spark-one {
  right: 6%;
  top: 30px;
  font-size: 42px;
}
.spark-two {
  left: 8%;
  bottom: 20px;
  font-size: 24px;
}
.art-caption {
  position: absolute;
  right: 1%;
  bottom: 8px;
  color: #5b6145;
  font-family: 'Songti SC', serif;
  font-size: 14px;
  line-height: 1.8;
}
.story-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #cdd0b8;
  padding-top: 15px;
}
.story-bottom p {
  margin: 0;
  color: #73775c;
  font-size: 12px;
  line-height: 1.9;
}
.story-bottom strong {
  color: #4f583c;
  font-weight: 500;
}
.story-stamp {
  padding: 9px;
  border: 1px solid #9da780;
  border-radius: 50%;
  font-size: 8px;
  line-height: 1.7;
  text-align: center;
  color: #727e56;
  transform: rotate(-12deg);
}
.discovery-divider {
  display: flex;
  justify-content: space-between;
  padding: 17px 0;
  margin-bottom: 46px;
  border-top: 1px solid #ded7c9;
  border-bottom: 1px solid #ded7c9;
  color: #7c6d54;
  font-size: 12px;
  letter-spacing: 0.12em;
}
.discovery-divider > span:last-child {
  font-size: 9px;
}
.scoring-invitation {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 25px;
  margin: 65px 0 34px;
  padding: 34px;
  border: 1px solid #e3d7bb;
  border-radius: 18px;
  background: #f2ebd9;
  align-items: center;
}
.scoring-invitation h2 {
  margin: 8px 0 12px;
  font-family: Georgia, 'Songti SC', serif;
  font-size: 27px;
  font-weight: 500;
}
.scoring-invitation p:not(.eyebrow) {
  margin: 0;
  max-width: 400px;
  color: #7c694e;
  font-size: 12px;
  line-height: 1.8;
}
.scoring-invitation .eyebrow {
  font-size: 9px;
}
.invitation-cups {
  display: flex;
  gap: 20px;
}
.invitation-cups :deep(.cup-badge) {
  flex-direction: column;
  gap: 7px;
  font-size: 12px;
}
.scoring-invitation > a {
  color: #85714a;
  font-size: 12px;
  text-decoration: none;
}
.discovery-footer {
  display: flex;
  justify-content: space-between;
  padding: 20px 0 32px;
  border-top: 1px solid #ded7c9;
  font-size: 12px;
  color: #7a6c54;
}
@media (max-width: 1000px) {
  .discovery-hero {
    gap: 32px;
  }
  .invitation-cups {
    gap: 12px;
  }
  .scoring-invitation {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 700px) {
  .discovery-page {
    width: calc(100% - 28px);
  }
  .discovery-hero {
    grid-template-columns: 1fr;
    padding-top: 36px;
    gap: 30px;
  }
  h1 {
    font-size: clamp(40px, 9vw, 60px);
  }
  .cup-story {
    max-width: 430px;
    width: calc(100% - 10px);
    justify-self: center;
  }
  .discovery-divider {
    margin-bottom: 28px;
    gap: 12px;
  }
  .discovery-divider > span:last-child {
    display: none;
  }
  .scoring-invitation {
    padding: 24px;
    margin-top: 40px;
  }
  .discovery-footer {
    gap: 15px;
    flex-direction: column;
  }
}
</style>

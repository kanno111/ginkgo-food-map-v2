<script setup lang="ts">
// 共享导航只接收身份状态；写评回跳由认证页面既有白名单验证。
defineProps<{ authenticated: boolean }>()
</script>
<template>
  <nav class="bottom-navigation" aria-label="应用导航">
    <RouterLink to="/" exact-active-class="selected"
      ><svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10" /></svg
      >首页</RouterLink
    ><RouterLink to="/map"
      ><svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2" /></svg
      >地图</RouterLink
    ><RouterLink
      class="compose-nav"
      :to="authenticated ? '/?writeReview=1' : '/login?redirect=%2F%3FwriteReview%3D1'"
      ><span>＋</span>写点评</RouterLink
    ><RouterLink to="/messages"
      ><svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 11a9 9 0 0 1-9 9H4l1-4a9 9 0 1 1 16-5Z" /></svg
      >消息</RouterLink
    ><RouterLink to="/account"
      ><svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="7" r="4" />
        <path d="M4 22v-3a8 8 0 0 1 16 0v3Z" /></svg
      >我的</RouterLink
    >
  </nav>
</template>
<style scoped>
.bottom-navigation {
  position: fixed;
  z-index: 20;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 36px;
  padding: 9px 16px calc(9px + env(safe-area-inset-bottom));
  background: #ffffffed;
  backdrop-filter: blur(14px);
  border-top: 1px solid #ede4d3;
}
.bottom-navigation a {
  display: grid;
  justify-items: center;
  gap: 3px;
  text-decoration: none;
  color: #6d7280;
  font-size: 12px;
  min-width: 72px;
}
.bottom-navigation a span {
  font-size: 25px;
  line-height: 28px;
}
.bottom-navigation .selected,
.bottom-navigation .router-link-active {
  color: #b47a13;
}
.compose-nav span {
  border-radius: 50%;
  background: #e9b949;
  color: #fff;
  width: 42px;
  text-align: center;
  margin-top: -16px;
  padding: 7px;
  box-shadow: 0 0 0 5px white;
}
@media (max-width: 600px) {
  .bottom-navigation {
    justify-content: space-around;
    gap: 0;
  }
  .bottom-navigation a {
    min-width: 0;
    width: 20%;
    font-size: 11px;
  }
}
.bottom-navigation svg {
  width: 26px;
  height: 28px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>

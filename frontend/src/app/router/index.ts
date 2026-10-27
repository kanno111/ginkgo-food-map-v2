import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/login/LoginPage.vue'),
      meta: { title: '登录账号' },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/home/HomePage.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/pages/register/RegisterPage.vue'),
      meta: { title: '注册账号' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// 单页应用切换路由时同步浏览器标题，便于用户识别当前页面。
router.afterEach((to) => {
  document.title = to.meta.title ? `${String(to.meta.title)} · Ginkgo 美食地图` : 'Ginkgo 美食地图'
})

export default router

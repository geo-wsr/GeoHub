import { createRouter, createWebHistory } from 'vue-router'

import { loadCurrentUser } from '@/stores/auth'
import { isLoadFailure, markOffline } from '@/stores/connection'

// 前端路由前缀 ≠ 资源前缀，两者用途不同：
//   1. GitHub Pages：两者相同，都是 /<仓库名>/（CI 会同时注入 VITE_BASE_PATH 与 VITE_ROUTER_BASE）
//   2. 交给 Django：资源在 /static/ 下（VITE_BASE_PATH），但页面由 catch-all 在站点根提供，
//      路由前缀必须是 /；若这里误用 /static/，SPA 生成的链接会变成 /static/login 这类 404 地址
const ROUTER_BASE = import.meta.env.VITE_ROUTER_BASE || '/'

const router = createRouter({
  history: createWebHistory(ROUTER_BASE),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { title: '首页' },
    },
    {
      path: '/materials',
      name: 'materials',
      component: () => import('@/views/MaterialListView.vue'),
      meta: { title: '资料库' },
    },
    {
      path: '/materials/:id(\\d+)',
      name: 'material-detail',
      component: () => import('@/views/MaterialDetailView.vue'),
      props: true,
      meta: { title: '资料详情' },
    },
    {
      path: '/upload',
      name: 'upload',
      component: () => import('@/views/UploadView.vue'),
      // 普通用户从个人中心走 /submit 进入同一个页面
      alias: '/submit',
      meta: { title: '上传资料', requiresAuth: true },
    },
    {
      path: '/forum',
      name: 'forum',
      component: () => import('@/views/ForumListView.vue'),
      meta: { title: '论坛' },
    },
    {
      path: '/forum/topic/:id(\\d+)',
      name: 'topic-detail',
      component: () => import('@/views/TopicDetailView.vue'),
      props: true,
      meta: { title: '帖子详情' },
    },
    {
      path: '/forum/new',
      name: 'topic-new',
      component: () => import('@/views/NewTopicView.vue'),
      meta: { title: '发布新帖', requiresAuth: true },
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('@/views/SearchView.vue'),
      meta: { title: '搜索' },
    },
    {
      path: '/review',
      name: 'review',
      component: () => import('@/views/ReviewView.vue'),
      meta: { title: '资料审核', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/me',
      name: 'profile',
      component: () => import('@/views/ProfileView.vue'),
      meta: { title: '个人中心', requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { title: '登录' },
    },
    {
      path: '/oauth/callback',
      name: 'oauth-callback',
      component: () => import('@/views/OAuthCallbackView.vue'),
      meta: { title: 'GitHub 登录' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '页面不存在' },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// 需要登录的页面先确认当前用户，未登录则带 redirect 跳转登录页
router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true
  const user = await loadCurrentUser()
  if (user) return true
  return { name: 'login', query: { redirect: to.fullPath } }
})

// 管理员专属页面（审核台）二次拦截，避免普通用户看到入口
router.beforeEach(async (to) => {
  if (!to.meta.requiresAdmin) return true
  const user = await loadCurrentUser()
  if (user?.is_staff) return true
  return { name: 'home' }
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · 地理资料库` : '地理资料库'
})

// 路由懒加载失败的处理。
// 典型场景：后端/开发服务器没启动时，点击导航会去请求该页面的 JS 分片，
// 请求失败 → 导航被中断 → 页面毫无反应（既不跳转也不报错）。
// 这里把它统一转换成"离线"状态，由全局横幅提示并可一键重试。
router.onError((error) => {
  if (isLoadFailure(error?.message)) {
    markOffline()
  }
})

export default router

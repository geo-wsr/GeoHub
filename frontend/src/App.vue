<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'

import { api } from '@/api'
import AppFooter from '@/components/AppFooter.vue'
import AppHeader from '@/components/AppHeader.vue'
import ConnectionBanner from '@/components/ConnectionBanner.vue'
import LoginPrompt from '@/components/LoginPrompt.vue'
import ToastHost from '@/components/ToastHost.vue'
import { loadCurrentUser } from '@/stores/auth'

// 等高线横线位置（配合曲线路径，营造低干扰的地理质感）
const contourRows = Array.from({ length: 14 }, (_, index) => 24 + index * 30)

onMounted(async () => {
  // 先确保拿到 csrftoken cookie，之后登录/评论等写请求才能带上正确 token
  try {
    await api.ensureCsrf()
  } catch {
    /* 拿不到 cookie 不影响浏览，只有写操作会失败 */
  }
  loadCurrentUser()
})
</script>

<template>
  <div class="app-shell">
    <!-- 极低透明度等高线纹理：浅色 2% 黑、深色 2% 白，不干扰内容阅读 -->
    <div class="contour" aria-hidden="true">
      <svg viewBox="0 0 420 460" preserveAspectRatio="none">
        <g fill="none" stroke="currentColor" stroke-width="1">
          <path
            v-for="y in contourRows"
            :key="y"
            :d="`M-20 ${y} C 60 ${y - 42} 130 ${y + 42} 210 ${y - 36} S 360 ${y + 40} 440 ${y - 28}`"
          />
          <path d="M110 168c28-22 74-20 96 6 20 24 10 56-22 68-34 13-76 6-94-18-16-22-6-42 20-56z" />
          <path d="M140 186c20-14 50-12 64 6 12 16 6 36-14 44-22 8-48 4-60-12-10-14-4-28 10-38z" />
        </g>
      </svg>
    </div>

    <AppHeader />

    <main class="app-main">
      <!-- 后端连不上时的全局提示（任一请求成功会自动消失） -->
      <ConnectionBanner />
      <RouterView v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <AppFooter />
    <ToastHost />
    <!-- 进站登录引导：游客首次访问时弹出，可关闭，不影响浏览 -->
    <LoginPrompt />
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.contour {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  color: var(--contour-color);
  opacity: var(--contour-opacity);
  transition: opacity var(--dur-theme) var(--ease), color var(--dur-theme) var(--ease);
}

.contour svg {
  width: 100%;
  height: 100%;
}

.app-main {
  position: relative;
  z-index: 1;
  flex: 1;
  padding-top: var(--nav-height);
}
</style>

<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import AppIcon from '@/components/AppIcon.vue'
import { loadCurrentUser } from '@/stores/auth'
import { pushToast } from '@/stores/toast'

// GitHub 授权完成后，后端会重定向到这里（FRONTEND_URL + /oauth/callback）。
// 这里再拉一次 /api/auth/me/ 把登录态落地，然后跳回首页。
const router = useRouter()
const failed = ref(false)

onMounted(async () => {
  const user = await loadCurrentUser(true)
  if (user) {
    pushToast(`已使用 GitHub 登录：${user.display_name || user.username}`, 'success')
    router.replace({ name: 'home' })
    return
  }
  failed.value = true
  pushToast('GitHub 登录未完成，请重试', 'error')
  window.setTimeout(() => router.replace({ name: 'login' }), 1500)
})
</script>

<template>
  <div class="container callback">
    <div class="card callback__card">
      <AppIcon name="globe" :size="28" />
      <h1>{{ failed ? '登录未完成' : '正在完成 GitHub 登录…' }}</h1>
      <p class="text-small text-muted">
        {{ failed ? '即将返回登录页，请重新尝试。' : '正在读取登录状态，请稍候。' }}
      </p>
      <RouterLink v-if="failed" class="btn btn--primary" :to="{ name: 'login' }">
        返回登录
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.callback {
  display: flex;
  justify-content: center;
  padding-top: 64px;
  padding-bottom: 40px;
}

.callback__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: min(420px, 100%);
  padding: 32px 28px;
  text-align: center;
  color: var(--color-secondary);
}
</style>
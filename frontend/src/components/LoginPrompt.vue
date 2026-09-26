<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { api } from '@/api'
import { authState } from '@/stores/auth'
import { pushToast } from '@/stores/toast'
import AppIcon from './AppIcon.vue'

/**
 * 进站欢迎弹窗（登录引导）。
 *
 * 产品要求"进入网站先弹出登录界面"，但本站对游客是只读开放的，
 * 所以这里做成**可关闭的引导弹窗**：不阻断浏览，只把登录/注册入口顶到眼前。
 * 每个浏览器会话只弹一次（sessionStorage 记标记），登录状态下永不出现。
 */
const STORAGE_KEY = 'mywebsite-login-prompted'
const visible = ref(false)
const github = ref({ enabled: false, loginUrl: '' })

function markPrompted() {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // 隐私模式下 sessionStorage 可能不可用，忽略即可
  }
}

function close() {
  visible.value = false
  markPrompted()
}

function loginWithGitHub() {
  if (!github.value.enabled) {
    pushToast('后端尚未配置 GitHub 登录（缺少 GITHUB_CLIENT_ID / SECRET）', 'info')
    return
  }
  // 整页跳到后端 OAuth 入口，授权完成后由后端重定向回 /oauth/callback
  window.location.href = github.value.loginUrl
}

function onKeydown(event) {
  if (event.key === 'Escape' && visible.value) close()
}

watch(
  () => authState.loaded && !authState.user,
  (shouldPrompt) => {
    if (!shouldPrompt) {
      if (authState.user) visible.value = false
      return
    }
    let prompted = false
    try {
      prompted = sessionStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      prompted = false
    }
    visible.value = !prompted
  },
  { immediate: true },
)

onMounted(async () => {
  document.addEventListener('keydown', onKeydown)
  try {
    const data = await api.authProviders()
    if (data?.github) {
      github.value = { enabled: data.github.enabled, loginUrl: data.github.login_url }
    }
  } catch {
    // 拉不到就只显示站内登录/注册入口
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="prompt" role="dialog" aria-modal="true" aria-labelledby="login-prompt-title">
        <div class="prompt__mask" @click="close" />
        <div class="prompt__card card">
          <button class="prompt__close" type="button" aria-label="关闭" @click="close">
            <AppIcon name="close" :size="16" />
          </button>

          <span class="prompt__logo">
            <AppIcon name="contour" :size="22" />
          </span>
          <h2 id="login-prompt-title" class="prompt__title">欢迎来到地理资料库</h2>
          <p class="prompt__desc">
            登录后即可下载资料、收藏课件、在论坛发帖讨论，也可以上传自己的笔记与真题。
          </p>

          <div class="prompt__actions">
            <button
              class="btn btn--secondary btn--block"
              type="button"
              @click="loginWithGitHub"
            >
              <AppIcon name="external" :size="16" />
              使用 GitHub 登录
            </button>
            <RouterLink
              class="btn btn--primary btn--block"
              :to="{ name: 'login', query: { mode: 'register' } }"
              @click="markPrompted"
            >
              <AppIcon name="user" :size="16" />
              注册新账号
            </RouterLink>
            <RouterLink
              class="btn btn--text btn--block"
              :to="{ name: 'login' }"
              @click="markPrompted"
            >
              已有账号？去登录
            </RouterLink>
          </div>

          <button class="prompt__skip text-small text-muted" type="button" @click="close">
            先随便看看
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.prompt {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 20px;
}

.prompt__mask {
  position: absolute;
  inset: 0;
  background: rgba(15, 20, 26, 0.45);
  backdrop-filter: blur(2px);
}

.prompt__card {
  position: relative;
  width: 100%;
  max-width: 380px;
  padding: 26px 24px 20px;
  text-align: center;
  animation: prompt-rise 0.28s var(--ease);
}

.prompt__close {
  position: absolute;
  top: 12px;
  right: 12px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
}

.prompt__close:hover {
  background: var(--bg-hover);
  color: var(--text-1);
}

.prompt__logo {
  display: inline-grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.prompt__title {
  margin: 14px 0 8px;
  font-size: var(--fs-h2);
  font-weight: var(--fw-semibold);
}

.prompt__desc {
  margin: 0 0 18px;
  color: var(--text-2);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
}

.prompt__actions {
  display: grid;
  gap: 10px;
}

.prompt__skip {
  margin-top: 14px;
  border: none;
  background: none;
  cursor: pointer;
}

.prompt__skip:hover {
  color: var(--text-1);
}

@keyframes prompt-rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

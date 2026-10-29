<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ADMIN_URL, api, ensureAwake, errorMessage } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import { signIn, signUp } from '@/stores/auth'
import { pushToast } from '@/stores/toast'

const route = useRoute()
const router = useRouter()

// 第三方登录入口由后端 /api/auth/providers/ 下发，前端不硬编码后端路径
const github = ref({ enabled: false, loginUrl: '' })
const backendStatus = ref('checking')

const backendNotice = computed(() => {
  if (backendStatus.value === 'ready') {
    return {
      title: '后端服务已连接',
      description:
        'Render 免费实例闲置后会休眠。当前服务已醒来；以后遇到冷启动会自动预热，登录请求最长等待 120 秒。',
    }
  }
  if (backendStatus.value === 'slow') {
    return {
      title: '后端暂未响应',
      description:
        '可能是免费实例仍在冷启动或当前网络波动。可以重新检测，也可以直接提交登录，请求最多等待 120 秒。',
    }
  }
  return {
    title: '正在连接后端服务',
    description:
      '后端部署在 Render 免费实例上，闲置后会休眠。首次访问通常需要 30–120 秒唤醒，页面正在自动预热，请保持当前页。',
  }
})

function loginWithGitHub() {
  if (!github.value.enabled) {
    pushToast('后端尚未配置 GitHub 登录（缺少 GITHUB_CLIENT_ID / SECRET）', 'info')
    return
  }
  // 整页跳到后端 OAuth 入口，授权完成后后端会重定向回 /oauth/callback
  window.location.href = github.value.loginUrl
}

async function checkBackend(force = false) {
  backendStatus.value = 'checking'
  const ready = await ensureAwake({ force })
  backendStatus.value = ready ? 'ready' : 'slow'
}

async function loadAuthProviders() {
  try {
    const data = await api.authProviders()
    github.value = {
      enabled: Boolean(data.github?.enabled),
      loginUrl: data.github?.login_url || '',
    }
    backendStatus.value = 'ready'
  } catch {
    github.value = { enabled: false, loginUrl: '' }
  }
}

onMounted(() => {
  // 两个轻量请求并行触发：一个负责冷启动预热，一个加载第三方登录入口。
  checkBackend()
  loadAuthProviders()
})

// 支持 /login?mode=register 直接落到注册页（首页的登录引导弹窗会这样跳）
const mode = ref(route.query.mode === 'register' ? 'register' : 'login')
const submitting = ref(false)
const error = ref('')

const form = reactive({
  username: '',
  password: '',
  nickname: '',
  email: '',
})

const title = computed(() => (mode.value === 'login' ? '登录' : '注册新账号'))

function switchMode(next) {
  if (mode.value === next) return
  mode.value = next
  error.value = ''
}

async function submit() {
  error.value = ''
  if (!form.username.trim() || !form.password) {
    error.value = '请填写用户名和密码。'
    return
  }
  if (mode.value === 'register' && form.password.length < 8) {
    error.value = '密码至少 8 位，且不能是纯数字。'
    return
  }

  submitting.value = true
  try {
    if (mode.value === 'login') {
      await signIn({ username: form.username.trim(), password: form.password })
    } else {
      await signUp({
        username: form.username.trim(),
        password: form.password,
        nickname: form.nickname.trim(),
        email: form.email.trim(),
      })
    }
    pushToast(mode.value === 'login' ? '登录成功' : '注册成功，已自动登录', 'success')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
    router.push(redirect || { name: 'home' })
  } catch (err) {
    if (
      err?.code === 'ECONNABORTED' ||
      /timeout of \d+ms exceeded/i.test(err?.message || '')
    ) {
      backendStatus.value = 'slow'
    }
    error.value = errorMessage(err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="container login">
    <div class="card login__card">
      <div class="login__brand">
        <span class="login__logo"><AppIcon name="contour" :size="22" /></span>
        <div>
          <h1 class="login__title">{{ title }}</h1>
          <p class="text-small text-muted">登录后可以上传资料、发表评论与收藏内容。</p>
        </div>
      </div>

      <div
        class="backend-notice"
        :class="`backend-notice--${backendStatus}`"
        role="status"
        aria-live="polite"
      >
        <span class="backend-notice__status" aria-hidden="true"></span>
        <div class="backend-notice__copy">
          <strong>{{ backendNotice.title }}</strong>
          <p>{{ backendNotice.description }}</p>
        </div>
        <button
          v-if="backendStatus === 'slow'"
          class="backend-notice__retry"
          type="button"
          @click="checkBackend(true)"
        >
          重新检测
        </button>
      </div>

      <div class="login__tabs">
        <button
          class="login__tab"
          :class="{ 'is-active': mode === 'login' }"
          type="button"
          @click="switchMode('login')"
        >
          登录
        </button>
        <button
          class="login__tab"
          :class="{ 'is-active': mode === 'register' }"
          type="button"
          @click="switchMode('register')"
        >
          注册
        </button>
      </div>

      <form @submit.prevent="submit">
        <label class="field">
          <span class="field__label">用户名<span class="field__required">*</span></span>
          <input
            v-model="form.username"
            class="input"
            type="text"
            autocomplete="username"
            placeholder="请输入用户名"
          />
        </label>

        <label v-if="mode === 'register'" class="field">
          <span class="field__label">昵称</span>
          <input v-model="form.nickname" class="input" type="text" placeholder="展示在评论区的名字" />
        </label>

        <label class="field">
          <span class="field__label">密码<span class="field__required">*</span></span>
          <input
            v-model="form.password"
            class="input"
            type="password"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            placeholder="请输入密码"
          />
          <span v-if="mode === 'register'" class="field__hint">至少 8 位，不能是纯数字。</span>
        </label>

        <label v-if="mode === 'register'" class="field">
          <span class="field__label">邮箱</span>
          <input v-model="form.email" class="input" type="email" placeholder="选填" />
        </label>

        <p v-if="error" class="field__error login__error">{{ error }}</p>

        <button class="btn btn--primary btn--block" type="submit" :disabled="submitting">
          {{
            submitting
              ? backendStatus === 'ready'
                ? '正在验证账号…'
                : '正在连接服务器…'
              : mode === 'login'
                ? '登录'
                : '注册并登录'
          }}
        </button>
      </form>

      <!-- GitHub 第三方登录（后端未配置 Client ID 时按钮禁用并给出提示） -->
      <div class="login__divider"><span>或</span></div>
      <button
        class="btn btn--secondary btn--block"
        type="button"
        :disabled="!github.enabled"
        @click="loginWithGitHub"
      >
        <AppIcon name="external" :size="16" />
        使用 GitHub 登录
      </button>
      <p v-if="!github.enabled" class="field__hint login__hint">
        后端未配置 GitHub OAuth，请在服务器环境变量中设置 GITHUB_CLIENT_ID 与 GITHUB_CLIENT_SECRET。
      </p>

      <p class="login__foot text-small text-muted">
        管理员账号请从
        <a :href="ADMIN_URL">后台入口</a>
        登录。
      </p>
    </div>
  </div>
</template>

<style scoped>
.login {
  display: flex;
  justify-content: center;
  padding-top: 56px;
  padding-bottom: 40px;
}

.login__card {
  width: min(420px, 100%);
  padding: 28px;
}

.login__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.login__logo {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: #fff;
}

.login__title {
  font-size: var(--fs-h2);
}

.backend-notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 18px;
  padding: 12px 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--color-secondary-soft);
}

.backend-notice__status {
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--color-secondary);
}

.backend-notice--checking .backend-notice__status {
  animation: status-breathe 1.2s var(--ease) infinite;
}

.backend-notice--ready {
  background: var(--status-approved-bg);
  border-color: var(--status-approved-border);
}

.backend-notice--ready .backend-notice__status {
  background: var(--color-success);
}

.backend-notice--slow {
  background: var(--status-pending-bg);
  border-color: var(--status-pending-border);
}

.backend-notice--slow .backend-notice__status {
  background: var(--status-pending-text);
}

.backend-notice__copy {
  flex: 1;
  min-width: 0;
}

.backend-notice__copy strong {
  display: block;
  color: var(--text-1);
  font-size: var(--fs-h4);
}

.backend-notice__copy p {
  margin-top: 3px;
  color: var(--text-2);
  font-size: var(--fs-small);
  line-height: 1.6;
  text-wrap: pretty;
}

.backend-notice__retry {
  flex: none;
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid currentColor;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--status-pending-text);
  font-size: var(--fs-small);
  cursor: pointer;
}

.backend-notice__retry:hover {
  background: var(--bg-hover);
}

.login__tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--border);
}

.login__tab {
  padding: 8px 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--text-2);
  font-size: var(--fs-h4);
  font-weight: var(--fw-medium);
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
}

.login__tab.is-active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.login__error {
  margin-bottom: 12px;
  margin-top: 0;
}

.login__divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 18px 0 14px;
  color: var(--text-3);
  font-size: var(--fs-small);
}

.login__divider::before,
.login__divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.login__hint {
  margin-top: 8px;
}

.login__foot {
  margin-top: 16px;
  text-align: center;
}

@keyframes status-breathe {
  50% {
    opacity: 0.35;
  }
}

@media (max-width: 480px) {
  .login {
    padding-top: 28px;
  }

  .login__card {
    padding: 22px 18px;
  }

  .backend-notice {
    flex-wrap: wrap;
  }

  .backend-notice__retry {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .backend-notice--checking .backend-notice__status {
    animation: none;
  }
}
</style>

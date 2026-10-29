import { reactive } from 'vue'

import { api } from '@/api'

export const authState = reactive({
  user: null,
  loaded: false,
})

export async function loadCurrentUser(force = false) {
  if (authState.loaded && !force) return authState.user
  try {
    const data = await api.me()
    authState.user = data.user
  } catch {
    authState.user = null
  } finally {
    authState.loaded = true
  }
  return authState.user
}

export async function signIn(payload) {
  await api.ensureAwake()
  const data = await api.login(payload)
  authState.user = data.user
  authState.loaded = true
  // 新后端会随登录响应返回轮换后的 token；兼容旧后端时再补取一次。
  if (!data.csrfToken) {
    try {
      await api.ensureCsrf()
    } catch {
      // 登录已经成功，不能因为补充 CSRF 失败而显示“登录失败”。
    }
  }
  return data.user
}

export async function signUp(payload) {
  await api.ensureAwake()
  const data = await api.register(payload)
  applyUser(data.user)
  if (!data.csrfToken) {
    try {
      await api.ensureCsrf()
    } catch {
      // 注册与登录已经成功；后续写请求会由错误提示负责恢复。
    }
  }
  return data.user
}

/** 用后端返回的最新用户信息覆盖本地状态（改头像/昵称后用）。 */
export function applyUser(user) {
  authState.user = user
  authState.loaded = true
  return user
}

export async function signOut() {
  const data = await api.logout()
  authState.user = null
  if (!data.csrfToken) {
    try {
      await api.ensureCsrf()
    } catch {
      // 已退出登录，补充 token 失败不应让用户停留在旧状态。
    }
  }
}

export function useAuth() {
  return authState
}

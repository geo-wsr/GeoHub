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
  const data = await api.login(payload)
  authState.user = data.user
  authState.loaded = true
  // 登录成功后 Django 会轮换 CSRF token，必须重新取一次，否则后续写请求 403
  await api.ensureCsrf()
  return data.user
}

export async function signUp(payload) {
  const data = await api.register(payload)
  authState.user = data.user
  authState.loaded = true
  await api.ensureCsrf()
  return data.user
}

export async function signOut() {
  await api.logout()
  authState.user = null
  // 登出同样会轮换 token
  await api.ensureCsrf()
}

export function useAuth() {
  return authState
}

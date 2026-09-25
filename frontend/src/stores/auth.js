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
  return data.user
}

export async function signUp(payload) {
  const data = await api.register(payload)
  authState.user = data.user
  authState.loaded = true
  return data.user
}

export async function signOut() {
  await api.logout()
  authState.user = null
}

export function useAuth() {
  return authState
}

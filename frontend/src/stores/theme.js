import { reactive } from 'vue'

const STORAGE_KEY = 'mywebsite-theme'
const VALID = ['light', 'dark']

function readStored() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (VALID.includes(saved)) return saved
  } catch {
    /* 隐私模式下 localStorage 可能不可用，忽略并回落到系统偏好 */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply(mode) {
  document.documentElement.dataset.theme = mode
}

export const themeState = reactive({ mode: readStored() })

// 首屏立即应用，避免闪白
apply(themeState.mode)

/** 一键切换主题，并持久化到 localStorage。 */
export function toggleTheme() {
  themeState.mode = themeState.mode === 'dark' ? 'light' : 'dark'
  apply(themeState.mode)
  try {
    localStorage.setItem(STORAGE_KEY, themeState.mode)
  } catch {
    /* 存不进就只在本次会话生效 */
  }
}

export function useTheme() {
  return themeState
}

import { reactive } from 'vue'

export const toasts = reactive([])

let seed = 0

/** 轻量提示：type 取 info / success / error */
export function pushToast(message, type = 'info', duration = 2800) {
  if (!message) return
  const id = (seed += 1)
  toasts.push({ id, message, type })
  window.setTimeout(() => {
    const index = toasts.findIndex((item) => item.id === id)
    if (index >= 0) toasts.splice(index, 1)
  }, duration)
}

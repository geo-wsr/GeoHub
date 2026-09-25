import { reactive } from 'vue'

import { api } from '@/api'
import { authState } from '@/stores/auth'

// 未读通知数由头部铃铛与个人中心共用，避免两处状态不一致
export const notificationState = reactive({ unread: 0 })

export async function refreshUnread() {
  if (!authState.user) {
    notificationState.unread = 0
    return
  }
  try {
    const data = await api.unreadNotificationCount()
    notificationState.unread = data.count
  } catch {
    notificationState.unread = 0
  }
}

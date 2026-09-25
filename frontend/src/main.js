import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { isLoadFailure, markOffline } from './stores/connection'
import './assets/base.css'

createApp(App).use(router).mount('#app')

// —— 资源加载失败的兜底捕获 ——
// Vue Router 的 onError 覆盖不到所有情况（例如 Vite 预加载 CSS 失败时抛出的
// "Unable to preload CSS for ..." 可能是未处理的 Promise 拒绝）。这里从全局再兜一层，
// 统一转成"离线"状态，由顶部横幅提示"后端可能没启动"并提供重试。
window.addEventListener('unhandledrejection', (event) => {
  if (isLoadFailure(event?.reason?.message)) markOffline()
})

window.addEventListener(
  'error',
  (event) => {
    const el = event.target
    if (!el || !('tagName' in el)) return
    if (!['SCRIPT', 'LINK'].includes(el.tagName)) return
    const url = String(el.src || el.href || '')
    // 只关心应用自己的分片资源，避免把 favicon 之类的小失败也算进来
    if (url.includes('/assets/')) markOffline()
  },
  true, // 资源加载错误不冒泡，必须用捕获阶段
)

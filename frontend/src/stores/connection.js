import { reactive } from 'vue'

/**
 * 后端连通性状态。
 *
 * 用途：避免"请求静默失败"让用户以为功能坏了（典型场景是本地后端没启动，
 * 点按钮没反应、列表空白）。api 的响应拦截器在网络层失败时置为离线，
 * 任意一次请求成功即恢复，全局横幅据此显示/隐藏。
 */
export const connectionState = reactive({
  offline: false,
  since: null,
})

export function markOffline() {
  if (!connectionState.offline) {
    connectionState.offline = true
    connectionState.since = Date.now()
  }
}

export function markOnline() {
  connectionState.offline = false
  connectionState.since = null
}

/**
 * 判断一个错误是否是"资源加载失败"（分片 JS/CSS 取不到）。
 * 典型场景：后端或开发服务器没启动时，点击导航会去拉该页面的分片，
 * 失败后导航被中断、页面毫无反应——这类错误文案因打包器而异，这里统一识别。
 */
const LOAD_FAILURE_PATTERN =
  /dynamically imported module|Importing a module script|Loading chunk|Unable to preload|Failed to fetch|NetworkError|Failed to load/i

export function isLoadFailure(message) {
  return LOAD_FAILURE_PATTERN.test(String(message || ''))
}

import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[2]) : null
}

// 每个写请求都重新读取 csrftoken：
// Django 在登录成功后会轮换 CSRF token，缓存旧值会直接导致 403。
client.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase()
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const token = readCookie('csrftoken')
    if (token) config.headers['X-CSRFToken'] = token
  }
  return config
})

/** 把 DRF 的各种错误结构统一成一句可展示的中文提示。 */
export function errorMessage(error) {
  const data = error?.response?.data
  if (!data) return error?.message || '网络异常，请稍后重试。'
  if (typeof data === 'string') return '请求失败，请稍后重试。'
  if (data.detail) return data.detail
  const first = Object.values(data)[0]
  if (Array.isArray(first)) return String(first[0])
  if (typeof first === 'string') return first
  return '请求失败，请稍后重试。'
}

export const api = {
  ensureCsrf: () => client.get('/auth/csrf/').then((r) => r.data),
  me: () => client.get('/auth/me/').then((r) => r.data),
  login: (payload) => client.post('/auth/login/', payload).then((r) => r.data),
  register: (payload) => client.post('/auth/register/', payload).then((r) => r.data),
  logout: () => client.post('/auth/logout/').then((r) => r.data),

  categories: () => client.get('/categories/').then((r) => r.data),
  hotTags: (limit = 8) => client.get('/tags/', { params: { hot: limit } }).then((r) => r.data),

  materials: (params = {}) => client.get('/materials/', { params }).then((r) => r.data),
  material: (id) => client.get(`/materials/${id}/`).then((r) => r.data),
  latestMaterials: () => client.get('/materials/latest/').then((r) => r.data),
  hotMaterials: () => client.get('/materials/hot/').then((r) => r.data),
  relatedMaterials: (id) => client.get(`/materials/${id}/related/`).then((r) => r.data),
  createMaterial: (formData, onUploadProgress) =>
    client
      .post('/materials/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress,
      })
      .then((r) => r.data),
  updateMaterial: (id, formData, onUploadProgress) =>
    client
      .patch(`/materials/${id}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress,
      })
      .then((r) => r.data),
  deleteMaterial: (id) => client.delete(`/materials/${id}/`),
  toggleFavorite: (id) => client.post(`/materials/${id}/favorite/`).then((r) => r.data),

  comments: (materialId, params = {}) =>
    client.get(`/materials/${materialId}/comments/`, { params }).then((r) => r.data),
  addComment: (materialId, payload) =>
    client.post(`/materials/${materialId}/comments/`, payload).then((r) => r.data),
  deleteComment: (commentId) => client.delete(`/comments/${commentId}/`),

  profile: () => client.get('/profile/').then((r) => r.data),
  favorites: (params = {}) => client.get('/favorites/', { params }).then((r) => r.data),
  myComments: (params = {}) => client.get('/my-comments/', { params }).then((r) => r.data),
  downloads: (params = {}) => client.get('/downloads/', { params }).then((r) => r.data),

  // 论坛：板块、帖子与楼层回复
  boards: () => client.get('/boards/').then((r) => r.data),
  topics: (params = {}) => client.get('/topics/', { params }).then((r) => r.data),
  topic: (id) => client.get(`/topics/${id}/`).then((r) => r.data),
  createTopic: (payload) => client.post('/topics/', payload).then((r) => r.data),
  updateTopic: (id, payload) => client.patch(`/topics/${id}/`, payload).then((r) => r.data),
  deleteTopic: (id) => client.delete(`/topics/${id}/`),
  topicPosts: (id, params = {}) =>
    client.get(`/topics/${id}/posts/`, { params }).then((r) => r.data),
  addTopicPost: (id, payload) =>
    client.post(`/topics/${id}/posts/`, payload).then((r) => r.data),
  deletePost: (id) => client.delete(`/posts/${id}/`),
  myTopics: (params = {}) => client.get('/my-topics/', { params }).then((r) => r.data),
  myPosts: (params = {}) => client.get('/my-posts/', { params }).then((r) => r.data),

  // 全局搜索：同时匹配资料与帖子
  search: (q) => client.get('/search/', { params: { q } }).then((r) => r.data),

  // 审核
  pendingMaterials: (params = {}) =>
    client.get('/materials/', { params: { status: 'pending', page_size: 48, ...params } }).then((r) => r.data),
  reviewMaterial: (id, payload) =>
    client.post(`/materials/${id}/review/`, payload).then((r) => r.data),

  // 站内通知
  notifications: (params = {}) => client.get('/notifications/', { params }).then((r) => r.data),
  unreadNotificationCount: () => client.get('/notifications/unread_count/').then((r) => r.data),
  markNotificationRead: (id) => client.post(`/notifications/${id}/mark_read/`).then((r) => r.data),
  markAllNotificationsRead: () => client.post('/notifications/mark_all_read/').then((r) => r.data),

  // 评论 / 楼层回复的编辑
  updateComment: (id, payload) => client.patch(`/comments/${id}/`, payload).then((r) => r.data),
  updatePost: (id, payload) => client.patch(`/posts/${id}/`, payload).then((r) => r.data),

  // 帖子置顶 / 加精（仅管理员）
  toggleTopicPin: (id) => client.post(`/topics/${id}/pin/`).then((r) => r.data),
  toggleTopicFeature: (id) => client.post(`/topics/${id}/feature/`).then((r) => r.data),
}

/** 下载走浏览器原生跳转：Content-Disposition: attachment 不会离开当前页。 */
export function downloadUrl(materialId) {
  return `/api/materials/${materialId}/download/`
}

export default client

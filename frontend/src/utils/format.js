/** 分类 slug → 线性图标名（自然地理山脈、人文地理建筑、GIS 卫星、区域地图、地质岩层） */
const CATEGORY_ICONS = {
  physical: 'mountain',
  human: 'building',
  gis: 'satellite',
  regional: 'map',
  geology: 'layers',
}

export function categoryIcon(slug) {
  return CATEGORY_ICONS[slug] || 'folder'
}

function pad(value) {
  return String(value).padStart(2, '0')
}

/** 统一时间格式：2026-09-25 12:30 */
export function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

export function formatDay(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 字节数 → 可读大小 */
export function formatSize(bytes) {
  const size = Number(bytes) || 0
  if (size <= 0) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  const rounded = index === 0 || value >= 10 ? Math.round(value) : value.toFixed(1)
  return `${rounded} ${units[index]}`
}

/** 扩展名 → 展示用大写标签 */
export function fileLabel(ext) {
  return (ext || '').replace('.', '').toUpperCase() || '文件'
}

/** 大数字缩写：1234 → 1.2k */
export function compactNumber(value) {
  const number = Number(value) || 0
  if (number < 1000) return String(number)
  if (number < 10000) return `${(number / 1000).toFixed(1)}k`
  return `${Math.round(number / 1000)}k`
}

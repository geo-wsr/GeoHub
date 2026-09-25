<script setup>
import { computed } from 'vue'

/**
 * 线性图标集（24×24 网格，统一 1.6 描边）。
 * 这里只是静态常量，用 v-html 渲染不会引入注入风险。
 */
const icons = {
  /* 品牌 Logo：等高线 */
  contour:
    '<path d="M3 11c3-4 6 2 9-2s6 1 9-3"/><path d="M3 15.5c3-4 6 2 9-2s6 1 9-3"/><path d="M3 20c3-4 6 2 9-2s6 1 9-3"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M15.6 15.6 21 21"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/>',
  moon: '<path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.7 8.7 0 1 0 11.1 11.1z"/>',
  user: '<circle cx="12" cy="8.2" r="3.4"/><path d="M5.2 20c1.4-3.4 3.9-5 6.8-5s5.4 1.6 6.8 5"/>',
  download: '<path d="M12 4v11.2"/><path d="M7.6 11 12 15.4 16.4 11"/><path d="M5 19.5h14"/>',
  upload: '<path d="M12 16.5V5.2"/><path d="M7.6 9.6 12 5.2l4.4 4.4"/><path d="M5 19.5h14"/>',
  heart:
    '<path d="M12 20.2S4.6 15.6 4.6 10.6A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.4 2.6c0 5-7.4 9.6-7.4 9.6z"/>',
  heartFilled:
    '<path d="M12 20.2S4.6 15.6 4.6 10.6A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.4 2.6c0 5-7.4 9.6-7.4 9.6z" fill="currentColor"/>',
  comment:
    '<path d="M20.4 12.4c0 3.6-3.8 6.6-8.4 6.6-1 0-2-.2-2.9-.5L4.6 20l1.3-3.3A6.7 6.7 0 0 1 3.6 12.4c0-3.6 3.8-6.6 8.4-6.6s8.4 3 8.4 6.6z"/>',
  reply: '<path d="M9.4 8.2 4.6 12.4l4.8 4.2"/><path d="M4.6 12.4h9.2a6 6 0 0 1 6 6v1.2"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.8h5V7"/><path d="M6.5 7l1 13h9l1-13"/>',
  mountain: '<path d="M2.8 19.2 9.2 7.6l4 6.2 2.2-3.2 5.8 8.6z"/>',
  building:
    '<path d="M4.8 20.2V6.2l7-3.4v17.4"/><path d="M11.8 10.4h7.4v9.8"/><path d="M7 9.6h2.2M7 13.2h2.2M7 16.8h2.2M14.4 13.2h2.2M14.4 16.8h2.2"/>',
  satellite:
    '<path d="M4.2 19.8 9 15"/><path d="M9.4 9.2a5.6 5.6 0 0 1 5.4 5.4"/><path d="M9.4 4.6A10.2 10.2 0 0 1 19.4 14.6"/><circle cx="16.8" cy="16.8" r="2.2"/>',
  map: '<path d="M3 6.6 9 4.2l6 2.4 6-2.4v13.2l-6 2.4-6-2.4-6 2.4z"/><path d="M9 4.2v13.2"/><path d="M15 6.6v13.2"/>',
  layers: '<path d="M12 3.6 3 8.6l9 5 9-5z"/><path d="M3 13.8l9 5 9-5"/>',
  globe:
    '<circle cx="12" cy="12" r="8.2"/><ellipse cx="12" cy="12" rx="3.4" ry="8.2"/><path d="M3.8 12h16.4"/>',
  book: '<path d="M12 6.4C10 4.9 7.6 4.2 4.2 4.2v13.6c3.4 0 5.8.7 7.8 2.2 2-1.5 4.4-2.2 7.8-2.2V4.2c-3.4 0-5.8.7-7.8 2.2z"/><path d="M12 6.4v13.6"/>',
  tag: '<path d="M4.2 12.2 12.2 4.2H20v7.8l-8 8z"/><circle cx="15.4" cy="8.8" r="1.4"/>',
  clock: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.2V12l3.2 2"/>',
  chevronLeft: '<path d="M14.4 6 8.4 12l6 6"/>',
  chevronRight: '<path d="M9.6 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.8 9.4 17.2 19 7.6"/>',
  alert:
    '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.6v5.2"/><circle cx="12" cy="16.4" r="0.9" fill="currentColor" stroke="none"/>',
  info:
    '<circle cx="12" cy="12" r="8.2"/><path d="M12 11v5.4"/><circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none"/>',
  eye: '<path d="M2.4 12S6 6.4 12 6.4 21.6 12 21.6 12 18 17.6 12 17.6 2.4 12 2.4 12z"/><circle cx="12" cy="12" r="3"/>',
  bell: '<path d="M6.8 10.4a5.2 5.2 0 0 1 10.4 0v3.8l1.6 2.6H5.2l1.6-2.6z"/><path d="M10 19.4a2 2 0 0 0 4 0"/>',
  arrowRight: '<path d="M4.6 12h14.8"/><path d="M13.4 6 19.4 12l-6 6"/>',
  logout:
    '<path d="M14.6 8.2V6.4a2 2 0 0 0-2-2H6.4a2 2 0 0 0-2 2v11.2a2 2 0 0 0 2 2h6.2a2 2 0 0 0 2-2v-1.8"/><path d="M10.4 12h9.2"/><path d="M16.6 8.6 20 12l-3.4 3.4"/>',
  folder:
    '<path d="M3.4 6.6h5.4l1.8 2.2h10v9.4a1.6 1.6 0 0 1-1.6 1.6H5a1.6 1.6 0 0 1-1.6-1.6z"/>',
  filter: '<path d="M3.6 6.4h16.8"/><path d="M6.6 12h10.8"/><path d="M9.6 17.6h4.8"/>',
  sort: '<path d="M7 4.6v14.8"/><path d="M3.6 16 7 19.4 10.4 16"/><path d="M14 6.4h6.4M14 12h5M14 17.6h3.6"/>',
  calendar:
    '<rect x="3.8" y="5.4" width="16.4" height="15" rx="2"/><path d="M3.8 10h16.4"/><path d="M8.4 3.4v3.4M15.6 3.4v3.4"/>',
  external:
    '<path d="M14 4.6h5.4V10"/><path d="M19.4 4.6 11 13"/><path d="M18.4 14.2v4.2a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18.4V7.2a1.6 1.6 0 0 1 1.6-1.6h4.2"/>',
}

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 20 },
  strokeWidth: { type: [Number, String], default: 1.6 },
})

// 必须用 computed：主题切换、收藏状态等会动态换图标名
const markup = computed(() => icons[props.name] || icons.info)
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <svg
    class="icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    v-html="markup"
  />
</template>

<style scoped>
.icon {
  display: block;
  flex: none;
}
</style>

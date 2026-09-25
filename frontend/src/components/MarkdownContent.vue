<script setup>
import { computed } from 'vue'

import { renderMarkdown } from '@/utils/markdown'

const props = defineProps({
  source: { type: String, default: '' },
})

// 渲染结果已经过 markdown-it（已禁用原始 HTML）+ DOMPurify 白名单清洗，
// 因此这里用 v-html 插入是安全的（样式在 base.css 的 .md-body 里统一定义）。
const html = computed(() => renderMarkdown(props.source))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="md-body" v-html="html" />
</template>

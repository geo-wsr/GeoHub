<script setup>
import { computed } from 'vue'

/** 审核状态标签：小型圆角胶囊，颜色全部走主题变量，深浅色自动适配 */
const props = defineProps({
  status: { type: String, default: 'pending' },
})

const MAP = {
  pending: { label: '待审核', tone: 'pending' },
  approved: { label: '已通过', tone: 'approved' },
  rejected: { label: '已驳回', tone: 'rejected' },
}

const meta = computed(() => MAP[props.status] || MAP.pending)
</script>

<template>
  <span class="status-pill" :class="`status-pill--${meta.tone}`">{{ meta.label }}</span>
</template>

<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 1px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  font-size: var(--fs-small);
  line-height: 1.7;
  white-space: nowrap;
}

.status-pill--pending {
  background: var(--status-pending-bg);
  border-color: var(--status-pending-border);
  color: var(--status-pending-text);
}

.status-pill--approved {
  background: var(--status-approved-bg);
  border-color: var(--status-approved-border);
  color: var(--status-approved-text);
}

.status-pill--rejected {
  background: var(--status-rejected-bg);
  border-color: var(--status-rejected-border);
  color: var(--status-rejected-text);
}
</style>

<script setup>
import { computed } from 'vue'

import AppIcon from './AppIcon.vue'

const props = defineProps({
  page: { type: Number, default: 1 },
  totalPages: { type: Number, default: 1 },
  total: { type: Number, default: 0 },
})

const emit = defineEmits(['update:page'])

/** 以当前页为中心取最多 5 个页码，避免页码过多撑破布局 */
const pages = computed(() => {
  const last = props.totalPages
  if (last <= 1) return []
  const start = Math.max(1, Math.min(props.page - 2, last - 4))
  const end = Math.min(last, start + 4)
  const list = []
  for (let i = start; i <= end; i += 1) list.push(i)
  return list
})

function go(target) {
  if (target < 1 || target > props.totalPages || target === props.page) return
  emit('update:page', target)
}
</script>

<template>
  <nav v-if="totalPages > 1" class="pager" aria-label="分页">
    <span class="pager__total">共 {{ total }} 条</span>
    <div class="pager__controls">
      <button
        class="pager__btn"
        type="button"
        :disabled="page <= 1"
        aria-label="上一页"
        @click="go(page - 1)"
      >
        <AppIcon name="chevronLeft" :size="16" />
      </button>
      <button
        v-for="item in pages"
        :key="item"
        class="pager__btn"
        :class="{ 'is-active': item === page }"
        type="button"
        :aria-current="item === page ? 'page' : undefined"
        @click="go(item)"
      >
        {{ item }}
      </button>
      <button
        class="pager__btn"
        type="button"
        :disabled="page >= totalPages"
        aria-label="下一页"
        @click="go(page + 1)"
      >
        <AppIcon name="chevronRight" :size="16" />
      </button>
    </div>
  </nav>
</template>

<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 28px;
}

.pager__total {
  font-size: var(--fs-small);
  color: var(--text-3);
}

.pager__controls {
  display: flex;
  gap: 6px;
}

.pager__btn {
  display: grid;
  place-items: center;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text-2);
  font-size: var(--fs-small);
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease),
    background-color var(--dur-fast) var(--ease);
}

.pager__btn:hover:not(:disabled) {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.pager__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pager__btn.is-active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}
</style>

<script setup>
defineProps({
  title: { type: String, default: '这里还没有内容' },
  description: { type: String, default: '' },
})
</script>

<template>
  <div class="empty">
    <!-- 简约地理元素线稿：书本 + 地球仪 -->
    <svg class="empty__art" viewBox="0 0 160 96" fill="none" aria-hidden="true">
      <g
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M18 70c14-3 28-3 42 2V34c-14-5-28-5-42-2z" />
        <path d="M60 36c14-3 28-3 42 2v38c-14-5-28-5-42-2z" />
        <path d="M116 26a20 20 0 1 0 0 40 20 20 0 0 0 0-40z" />
        <path d="M116 26v40" />
        <path d="M96.6 40h38.8M96.6 52h38.8" />
        <path d="M116 66v14" />
        <path d="M104 84h24" />
      </g>
    </svg>
    <h3 class="empty__title">{{ title }}</h3>
    <p v-if="description" class="empty__desc">{{ description }}</p>
    <div v-if="$slots.action" class="empty__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  text-align: center;
  color: var(--text-3);
}

.empty__art {
  width: 160px;
  height: 96px;
  color: var(--border-strong);
  margin-bottom: 16px;
}

.empty__title {
  color: var(--text-2);
  font-size: var(--fs-h3);
  margin-bottom: 6px;
}

.empty__desc {
  max-width: 420px;
  font-size: var(--fs-small);
  line-height: var(--lh-body);
}

.empty__action {
  margin-top: 18px;
}
</style>

<script setup>
import { toasts } from '@/stores/toast'
import AppIcon from './AppIcon.vue'

const ICONS = { info: 'info', success: 'check', error: 'alert' }
</script>

<template>
  <div class="toast-host" role="status" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="toast in toasts" :key="toast.id" class="toast" :class="`toast--${toast.type}`">
        <AppIcon :name="ICONS[toast.type] || 'info'" :size="16" />
        <span>{{ toast.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: calc(var(--nav-height) + 16px);
  right: 24px;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 340px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  box-shadow: var(--shadow-card-hover);
  color: var(--text-1);
  font-size: var(--fs-body);
  transition: background-color var(--dur-theme) var(--ease);
}

.toast--success {
  color: var(--color-success);
}

.toast--error {
  color: var(--color-danger);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

@media (max-width: 1024px) {
  .toast-host {
    right: 16px;
    left: 16px;
  }

  .toast {
    max-width: none;
  }
}
</style>

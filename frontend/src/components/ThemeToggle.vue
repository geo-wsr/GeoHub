<script setup>
import { computed, ref } from 'vue'

import { toggleTheme, useTheme } from '@/stores/theme'
import AppIcon from './AppIcon.vue'

const theme = useTheme()
const spinning = ref(false)

const isDark = computed(() => theme.mode === 'dark')

function handleClick() {
  // 点击时做一次 360° 旋转过渡
  spinning.value = true
  toggleTheme()
  window.setTimeout(() => {
    spinning.value = false
  }, 320)
}
</script>

<template>
  <button
    class="theme-toggle"
    type="button"
    :class="{ 'is-spinning': spinning }"
    :aria-label="isDark ? '切换到浅色主题' : '切换到深色主题'"
    :title="isDark ? '切换到浅色主题' : '切换到深色主题'"
    @click="handleClick"
  >
    <AppIcon :name="isDark ? 'sun' : 'moon'" :size="18" />
  </button>
</template>

<style scoped>
.theme-toggle {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--bg-card);
  color: var(--text-2);
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease),
    background-color var(--dur-theme) var(--ease), transform 0.32s var(--ease);
}

.theme-toggle:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.theme-toggle.is-spinning {
  transform: rotate(360deg);
}
</style>

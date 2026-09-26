<script setup>
import { computed } from 'vue'

import AppIcon from './AppIcon.vue'

const props = defineProps({
  name: { type: String, default: '' },
  size: { type: Number, default: 32 },
  // 用户上传的头像地址；为空则回落成首字 / 地球占位图
  src: { type: String, default: '' },
})

/** 有名字就取首字，没有就用一线地球占位头像 */
const initial = computed(() => (props.name ? props.name.trim().slice(0, 1) : ''))
</script>

<template>
  <span
    class="avatar"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.42)}px` }"
  >
    <img v-if="src" class="avatar__img" :src="src" :alt="name || '用户头像'" />
    <span v-else-if="initial">{{ initial }}</span>
    <AppIcon v-else name="globe" :size="Math.round(size * 0.56)" />
  </span>
</template>

<style scoped>
.avatar {
  display: grid;
  place-items: center;
  flex: none;
  overflow: hidden;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: var(--fw-medium);
  line-height: 1;
  user-select: none;
  transition: background-color var(--dur-theme) var(--ease);
}

.avatar__img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
</style>

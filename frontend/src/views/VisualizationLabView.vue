<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { setTheme, useTheme } from '@/stores/theme'

const route = useRoute()
const router = useRouter()
const theme = useTheme()
const frame = ref(null)
const loading = ref(true)
const loadFailed = ref(false)

const labId = computed(() => String(route.params.lab || 'atmosphere'))
const labUrl = computed(() => {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  return `${base}lab/index.html?theme=${theme.mode}#${labId.value}`
})

watch(
  () => route.params.lab,
  () => {
    loading.value = true
    loadFailed.value = false
  },
)

function handleHostMessage(event) {
  if (event.origin !== window.location.origin) return
  if (event.source !== frame.value?.contentWindow) return

  if (event.data?.type === 'geohub:return-to-labs') {
    router.push({ name: 'visualization' })
  }

  if (event.data?.type === 'geohub:lab-theme') {
    setTheme(event.data.theme)
  }
}

onMounted(() => {
  window.addEventListener('message', handleHostMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleHostMessage)
})
</script>

<template>
  <div class="lab-runtime">
    <div v-if="loading && !loadFailed" class="lab-runtime__loading" aria-live="polite">
      <span class="lab-runtime__loader" aria-hidden="true"></span>
      正在载入交互实验室…
    </div>

    <div v-if="loadFailed" class="lab-runtime__error" role="alert">
      <h1>实验室暂时无法载入</h1>
      <p>请检查网络后重试，或返回可视化实验室选择其他实验。</p>
      <div>
        <button class="btn btn--primary" type="button" @click="$router.go(0)">重新载入</button>
        <RouterLink class="btn btn--secondary" :to="{ name: 'visualization' }">
          返回实验室目录
        </RouterLink>
      </div>
    </div>

    <iframe
      v-show="!loadFailed"
      ref="frame"
      :src="labUrl"
      :title="`${labId} 可视化实验室`"
      class="lab-runtime__frame"
      allow="fullscreen"
      @load="loading = false"
      @error="loadFailed = true"
    ></iframe>
  </div>
</template>

<style scoped>
.lab-runtime {
  position: fixed;
  inset: 0;
  z-index: 80;
  overflow: hidden;
  background: var(--bg-page);
}

.lab-runtime__frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: var(--bg-page);
}

.lab-runtime__loading {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  color: var(--text-2);
  background: var(--bg-page);
}

.lab-runtime__loader {
  width: 28px;
  height: 28px;
  border: 2px solid var(--border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: lab-spin 0.8s linear infinite;
}

.lab-runtime__error {
  display: grid;
  min-height: 100%;
  padding: 32px;
  place-content: center;
  justify-items: start;
  gap: 14px;
  background: var(--bg-page);
}

.lab-runtime__error p {
  max-width: 560px;
  color: var(--text-2);
}

@keyframes lab-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .lab-runtime__loader {
    animation: none;
  }
}
</style>

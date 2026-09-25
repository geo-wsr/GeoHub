<script setup>
import { ref } from 'vue'

import { API_ROOT, api } from '@/api'
import { connectionState, markOnline } from '@/stores/connection'
import AppIcon from './AppIcon.vue'

const retrying = ref(false)

/** 探活：拿一个轻量接口试一次；通了就刷新页面把数据补回来 */
async function retry() {
  retrying.value = true
  try {
    await api.categories()
    markOnline()
    window.location.reload()
  } catch {
    // 仍然连不上：保持横幅可见
  } finally {
    retrying.value = false
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="connectionState.offline" class="conn" role="alert">
      <div class="container conn__inner">
        <AppIcon name="alert" :size="16" />
        <span class="conn__text">
          暂时连不上后端服务，页面数据可能显示不全。
          <span class="conn__hint">
            免费实例休眠后唤醒需要 30~60 秒，稍等片刻再点「重试」；接口地址：<code>{{ API_ROOT }}</code>
          </span>
        </span>
        <button class="conn__btn" type="button" :disabled="retrying" @click="retry">
          {{ retrying ? '检测中…' : '重试' }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.conn {
  /* 贴在固定导航栏下方，滚动时保持可见，同时占据正常文档流（不遮挡内容） */
  position: sticky;
  top: var(--nav-height);
  z-index: 40;
  border-bottom: 1px solid var(--status-rejected-border);
  background: var(--status-rejected-bg);
  color: var(--status-rejected-text);
}

.conn__inner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 10px;
  padding-bottom: 10px;
}

.conn__text {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-small);
  line-height: var(--lh-small);
}

.conn__hint {
  display: block;
  opacity: 0.8;
}

.conn__hint code {
  background: transparent;
  color: inherit;
  opacity: 0.9;
}

.conn__btn {
  flex: none;
  padding: 4px 12px;
  border: 1px solid currentColor;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font-size: var(--fs-small);
  cursor: pointer;
  transition: opacity var(--dur-fast) var(--ease), background-color var(--dur-fast) var(--ease);
}

.conn__btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.06);
}

.conn__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

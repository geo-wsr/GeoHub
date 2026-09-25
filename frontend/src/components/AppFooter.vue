<template>
  <footer class="site-footer">
    <div class="container site-footer__inner">
      <p class="site-footer__line">mywebsite · 地理学学习资料共享平台</p>
      <p class="site-footer__meta">
        Vue 3 + Vite 前台 · Django REST Framework 后端 ·
        <a :href="ADMIN_URL">管理后台</a>
      </p>
    </div>
  </footer>
</template>

<script setup>
// 后台地址随 API 域名走，跨域部署（Pages + Render）时不会指错站点
import { ADMIN_URL } from '@/api'
</script>

<style scoped>
.site-footer {
  margin-top: 48px;
  border-top: 1px solid var(--border);
  background: var(--bg-card);
  transition: background-color var(--dur-theme) var(--ease),
    border-color var(--dur-theme) var(--ease);
}

.site-footer__inner {
  padding: 24px var(--gutter);
}

.site-footer__line {
  color: var(--text-2);
  font-size: var(--fs-h4);
}

.site-footer__meta {
  margin-top: 4px;
  color: var(--text-3);
  font-size: var(--fs-small);
}
</style>

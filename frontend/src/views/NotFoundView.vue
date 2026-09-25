<script setup>
import { RouterLink } from 'vue-router'

import EmptyState from '@/components/EmptyState.vue'
</script>

<template>
  <div class="container not-found">
    <EmptyState title="页面不存在" description="链接可能已失效，或者地址输入有误。">
      <template #action>
        <RouterLink class="btn btn--primary" :to="{ name: 'home' }">回到首页</RouterLink>
      </template>
    </EmptyState>
  </div>
</template>

<style scoped>
.not-found {
  padding-top: 60px;
  padding-bottom: 40px;
}
</style>

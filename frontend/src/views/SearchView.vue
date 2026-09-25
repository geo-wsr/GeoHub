<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { api } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import MaterialCard from '@/components/MaterialCard.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import TopicCard from '@/components/TopicCard.vue'

const route = useRoute()
const router = useRouter()

const keyword = ref(route.query.q || '')
const result = ref({ materials: [], topics: [], material_total: 0, topic_total: 0 })
const loading = ref(false)
const searched = ref(false)

const total = computed(() => result.value.material_total + result.value.topic_total)

async function search() {
  const value = String(route.query.q || '').trim()
  keyword.value = value
  if (!value) {
    result.value = { materials: [], topics: [], material_total: 0, topic_total: 0 }
    searched.value = false
    return
  }
  loading.value = true
  searched.value = true
  try {
    result.value = await api.search(value)
  } catch {
    result.value = { materials: [], topics: [], material_total: 0, topic_total: 0 }
  } finally {
    loading.value = false
  }
}

function submit() {
  const value = keyword.value.trim()
  router.push({ name: 'search', query: value ? { q: value } : {} })
}

watch(
  () => route.query.q,
  () => search(),
  { immediate: true },
)
</script>

<template>
  <div class="container search">
    <header class="search__head">
      <h1>全局搜索</h1>
      <form class="search__form" role="search" @submit.prevent="submit">
        <AppIcon class="search__icon" name="search" :size="16" />
        <input
          v-model="keyword"
          class="search__input"
          type="search"
          placeholder="搜索资料标题、简介、标签，或论坛帖子"
          aria-label="全局搜索"
        />
        <button class="btn btn--primary" type="submit">搜索</button>
      </form>
      <p v-if="searched && !loading" class="text-small text-muted">
        关键词「<span class="text-secondary">{{ route.query.q }}</span>」共匹配
        <span class="num">{{ total }}</span> 条结果：资料
        <span class="num">{{ result.material_total }}</span> 份、帖子
        <span class="num">{{ result.topic_total }}</span> 个
      </p>
    </header>

    <div v-if="loading" class="grid">
      <SkeletonCard v-for="index in 4" :key="index" />
    </div>

    <EmptyState
      v-else-if="!searched"
      title="输入关键词开始搜索"
      description="资料与论坛帖子会一起被检索。"
    />

    <EmptyState
      v-else-if="!total"
      title="没有找到匹配的内容"
      description="换个关键词试试，或到论坛发帖求助。"
    >
      <template #action>
        <RouterLink class="btn btn--secondary" :to="{ name: 'forum' }">去论坛看看</RouterLink>
      </template>
    </EmptyState>

    <template v-else>
      <section v-if="result.materials.length" class="section">
        <div class="section-head">
          <h2>学习资料</h2>
          <RouterLink
            class="section-head__more"
            :to="{ name: 'materials', query: { search: route.query.q } }"
          >
            查看全部
            <AppIcon name="chevronRight" :size="14" />
          </RouterLink>
        </div>
        <div class="grid">
          <MaterialCard v-for="item in result.materials" :key="item.id" :material="item" />
        </div>
      </section>

      <section v-if="result.topics.length" class="section">
        <div class="section-head">
          <h2>论坛帖子</h2>
          <RouterLink
            class="section-head__more"
            :to="{ name: 'forum', query: { search: route.query.q } }"
          >
            查看全部
            <AppIcon name="chevronRight" :size="14" />
          </RouterLink>
        </div>
        <div class="grid">
          <TopicCard v-for="item in result.topics" :key="item.id" :topic="item" />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.search {
  padding-top: 28px;
  padding-bottom: 24px;
}

.search__head {
  margin-bottom: 24px;
}

.search__form {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 16px 0 10px;
  max-width: 620px;
}

.search__icon {
  position: absolute;
  left: 12px;
  color: var(--text-3);
  pointer-events: none;
}

.search__input {
  flex: 1;
  padding: 9px 12px 9px 34px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text-1);
  font-family: inherit;
  font-size: var(--fs-body);
  transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
}

.search__input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
}

.section-head__more {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--fs-small);
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 1280px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1024px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

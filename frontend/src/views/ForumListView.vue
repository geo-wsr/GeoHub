<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { api } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import TopicCard from '@/components/TopicCard.vue'
import { authState } from '@/stores/auth'
import { categoryIcon } from '@/utils/format'

const route = useRoute()
const router = useRouter()

const PAGE_SIZE = 10
const ORDERINGS = [
  { value: 'new', label: '最新发布' },
  { value: 'hot', label: '热门回复' },
]

const boards = ref([])
const topics = ref([])
const total = ref(0)
const loading = ref(true)

const currentBoard = computed(() => route.query.board || '')
const currentTag = computed(() => route.query.tag || '')
const ordering = computed(() => route.query.ordering || 'new')
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

const activeBoardName = computed(() => {
  if (!currentBoard.value) return '全部板块'
  return boards.value.find((item) => item.slug === currentBoard.value)?.name || '全部板块'
})

const allTopics = computed(() =>
  boards.value.reduce((sum, item) => sum + (item.topic_count || 0), 0),
)

async function load() {
  loading.value = true
  try {
    const data = await api.topics({
      board: currentBoard.value || undefined,
      tag: currentTag.value || undefined,
      ordering: ordering.value,
      page: page.value,
      page_size: PAGE_SIZE,
    })
    topics.value = Array.isArray(data) ? data : data.results
    total.value = Array.isArray(data) ? data.length : data.count
  } catch {
    topics.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function updateQuery(patch) {
  const query = { ...route.query, ...patch }
  if (!query.ordering || query.ordering === 'new') delete query.ordering
  Object.keys(query).forEach((key) => {
    if (query[key] === '' || query[key] === undefined || query[key] === null) delete query[key]
  })
  router.push({ name: 'forum', query })
}

watch(
  () => route.query,
  () => load(),
)

onMounted(async () => {
  try {
    boards.value = await api.boards()
  } catch {
    boards.value = []
  }
  load()
})
</script>

<template>
  <div class="container forum">
    <header class="list-head">
      <div>
        <h1>{{ activeBoardName }}</h1>
        <p class="list-head__desc">
          共 <span class="num">{{ total }}</span> 个主题
          <template v-if="currentTag">
            · 标签「<span class="text-secondary">{{ currentTag }}</span>」</template
          >
        </p>
      </div>

      <div class="toolbar">
        <label class="toolbar__sort">
          <AppIcon name="sort" :size="15" />
          <select
            class="toolbar__select"
            :value="ordering"
            aria-label="排序方式"
            @change="updateQuery({ ordering: $event.target.value, page: undefined })"
          >
            <option v-for="item in ORDERINGS" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </label>
        <!-- 发帖按钮：登录用户可见 -->
        <RouterLink
          v-if="authState.user"
          class="btn btn--primary btn--sm"
          :to="{ name: 'topic-new', query: currentBoard ? { board: currentBoard } : {} }"
        >
          <AppIcon name="plus" :size="16" />
          发帖
        </RouterLink>
        <RouterLink
          v-else
          class="btn btn--secondary btn--sm"
          :to="{ name: 'login', query: { redirect: route.fullPath } }"
        >
          登录后发帖
        </RouterLink>
      </div>
    </header>

    <div class="forum__body">
      <!-- 左侧板块导航 -->
      <aside class="board-nav card">
        <h3 class="board-nav__title">
          <AppIcon name="grid" :size="16" />
          论坛板块
        </h3>
        <ul class="board-nav__list">
          <li>
            <button
              class="board-nav__item"
              :class="{ 'is-active': !currentBoard }"
              type="button"
              @click="updateQuery({ board: undefined, page: undefined })"
            >
              <AppIcon name="globe" :size="16" />
              <span class="board-nav__name">全部板块</span>
              <span class="board-nav__count num">{{ allTopics }}</span>
            </button>
          </li>
          <li v-for="item in boards" :key="item.slug">
            <button
              class="board-nav__item"
              :class="{ 'is-active': currentBoard === item.slug }"
              type="button"
              @click="updateQuery({ board: item.slug, page: undefined })"
            >
              <AppIcon :name="categoryIcon(item.slug)" :size="16" />
              <span class="board-nav__name">{{ item.name }}</span>
              <span class="board-nav__count num">{{ item.topic_count }}</span>
            </button>
          </li>
        </ul>
      </aside>

      <section class="forum__main">
        <div v-if="loading" class="topic-grid">
          <SkeletonCard v-for="index in 4" :key="index" />
        </div>

        <EmptyState
          v-else-if="!topics.length"
          title="这个板块还没有帖子"
          description="把你的问题或经验写下来，和同学一起讨论。"
        >
          <template #action>
            <RouterLink
              v-if="authState.user"
              class="btn btn--primary"
              :to="{ name: 'topic-new', query: currentBoard ? { board: currentBoard } : {} }"
            >
              发布第一帖
            </RouterLink>
            <RouterLink
              v-else
              class="btn btn--primary"
              :to="{ name: 'login', query: { redirect: route.fullPath } }"
            >
              登录后发帖
            </RouterLink>
          </template>
        </EmptyState>

        <template v-else>
          <div class="topic-grid">
            <TopicCard v-for="item in topics" :key="item.id" :topic="item" />
          </div>
          <PaginationBar
            :page="page"
            :total-pages="totalPages"
            :total="total"
            @update:page="(next) => updateQuery({ page: next })"
          />
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.forum {
  padding-top: 28px;
  padding-bottom: 24px;
}

.list-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.list-head__desc {
  margin-top: 4px;
  color: var(--text-3);
  font-size: var(--fs-small);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar__sort {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text-2);
  transition: border-color var(--dur-fast) var(--ease);
}

.toolbar__sort:hover {
  border-color: var(--color-primary);
}

.toolbar__select {
  border: 0;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: var(--fs-small);
  cursor: pointer;
}

.toolbar__select:focus {
  outline: none;
}

/* 与资料列表页一致的"左导航 + 右列表"布局 */
.forum__body {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.board-nav {
  position: sticky;
  top: calc(var(--nav-height) + 24px);
  padding: 16px;
}

.board-nav__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  color: var(--text-2);
  font-size: var(--fs-h4);
}

.board-nav__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.board-nav__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--text-2);
  font-size: var(--fs-h4);
  text-align: left;
  cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
}

.board-nav__item:hover {
  background: var(--bg-hover);
  color: var(--color-primary);
}

.board-nav__item.is-active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: var(--fw-medium);
}

.board-nav__name {
  flex: 1;
}

.board-nav__count {
  color: var(--text-3);
  font-size: var(--fs-small);
}

.topic-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 1024px) {
  .forum__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .board-nav {
    position: static;
  }

  .board-nav__list {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .topic-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

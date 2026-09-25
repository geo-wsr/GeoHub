<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { api } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import MaterialCard from '@/components/MaterialCard.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import { categoryIcon } from '@/utils/format'

const route = useRoute()
const router = useRouter()

const PAGE_SIZE = 12
const ORDERINGS = [
  { value: 'new', label: '最新上传' },
  { value: 'downloads', label: '下载最多' },
  { value: 'favorites', label: '收藏最多' },
]

const categories = ref([])
const materials = ref([])
const total = ref(0)
const loading = ref(true)

const currentCategory = computed(() => route.query.category || '')
const currentTag = computed(() => route.query.tag || '')
const keyword = computed(() => route.query.search || '')
const ordering = computed(() => route.query.ordering || 'new')
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

const activeCategoryName = computed(() => {
  if (!currentCategory.value) return '全部资料'
  return categories.value.find((item) => item.slug === currentCategory.value)?.name || '全部资料'
})

const allCount = computed(() =>
  categories.value.reduce((sum, item) => sum + (item.material_count || 0), 0),
)

async function load() {
  loading.value = true
  try {
    const data = await api.materials({
      category: currentCategory.value || undefined,
      tag: currentTag.value || undefined,
      search: keyword.value || undefined,
      ordering: ordering.value,
      page: page.value,
      page_size: PAGE_SIZE,
    })
    materials.value = Array.isArray(data) ? data : data.results
    total.value = Array.isArray(data) ? data.length : data.count
  } catch {
    materials.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

/** 筛选条件统一写进 query，保证链接可分享、可前进后退 */
function updateQuery(patch) {
  const query = { ...route.query, ...patch }
  if (!query.ordering || query.ordering === 'new') delete query.ordering
  Object.keys(query).forEach((key) => {
    if (query[key] === '' || query[key] === undefined || query[key] === null) delete query[key]
  })
  router.push({ name: 'materials', query })
}

function resetFilters() {
  router.push({ name: 'materials' })
}

watch(
  () => route.query,
  () => load(),
)

onMounted(async () => {
  try {
    categories.value = await api.categories()
  } catch {
    categories.value = []
  }
  load()
})
</script>

<template>
  <div class="container list-page">
    <header class="list-head">
      <div>
        <h1>{{ activeCategoryName }}</h1>
        <p class="list-head__desc">
          共 <span class="num">{{ total }}</span> 份资料
          <template v-if="keyword">
            · 关键词「<span class="text-secondary">{{ keyword }}</span>」</template
          >
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
        <button
          v-if="currentCategory || currentTag || keyword"
          class="btn btn--text btn--sm"
          type="button"
          @click="resetFilters"
        >
          清除筛选
        </button>
      </div>
    </header>

    <div class="list-body">
      <!-- 左侧分类筛选栏 -->
      <aside class="filter card">
        <h3 class="filter__title">
          <AppIcon name="filter" :size="16" />
          分类筛选
        </h3>
        <ul class="filter__list">
          <li>
            <button
              class="filter__item"
              :class="{ 'is-active': !currentCategory }"
              type="button"
              @click="updateQuery({ category: undefined, page: undefined })"
            >
              <AppIcon name="grid" :size="16" />
              <span class="filter__name">全部资料</span>
              <span class="filter__count num">{{ allCount }}</span>
            </button>
          </li>
          <li v-for="item in categories" :key="item.slug">
            <button
              class="filter__item"
              :class="{ 'is-active': currentCategory === item.slug }"
              type="button"
              @click="updateQuery({ category: item.slug, page: undefined })"
            >
              <AppIcon :name="categoryIcon(item.slug)" :size="16" />
              <span class="filter__name">{{ item.name }}</span>
              <span class="filter__count num">{{ item.material_count }}</span>
            </button>
          </li>
        </ul>
      </aside>

      <!-- 右侧资料卡片网格：一行 4 个 -->
      <section class="list-main">
        <div v-if="loading" class="grid">
          <SkeletonCard v-for="index in 8" :key="index" />
        </div>

        <EmptyState
          v-else-if="!materials.length"
          title="没有找到匹配的资料"
          description="换个关键词或分类试试，也可以直接上传一份。"
        >
          <template #action>
            <RouterLink class="btn btn--primary" :to="{ name: 'upload' }">上传资料</RouterLink>
          </template>
        </EmptyState>

        <template v-else>
          <div class="grid">
            <MaterialCard v-for="item in materials" :key="item.id" :material="item" />
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
.list-page {
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

.list-body {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.filter {
  position: sticky;
  top: calc(var(--nav-height) + 24px);
  padding: 16px;
}

.filter__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  color: var(--text-2);
  font-size: var(--fs-h4);
}

.filter__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.filter__item {
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

.filter__item:hover {
  background: var(--bg-hover);
  color: var(--color-primary);
}

.filter__item.is-active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: var(--fw-medium);
}

.filter__name {
  flex: 1;
}

.filter__count {
  color: var(--text-3);
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
  .list-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .filter {
    position: static;
  }

  .filter__list {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

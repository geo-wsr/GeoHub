<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { api } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import MaterialCard from '@/components/MaterialCard.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import TopicCard from '@/components/TopicCard.vue'
import { categoryIcon } from '@/utils/format'

const categories = ref([])
const hotTags = ref([])
const hotMaterials = ref([])
const latestMaterials = ref([])
const hotTopics = ref([])
const loading = ref(true)

const totalMaterials = computed(() =>
  categories.value.reduce((sum, item) => sum + (item.material_count || 0), 0),
)

onMounted(async () => {
  try {
    const [categoryList, tagList, hot, latest, topics] = await Promise.all([
      api.categories(),
      api.hotTags(10),
      api.hotMaterials(),
      api.latestMaterials(),
      api.topics({ ordering: 'hot', page_size: 5 }),
    ])
    categories.value = categoryList
    hotTags.value = tagList
    hotMaterials.value = hot
    latestMaterials.value = latest
    hotTopics.value = Array.isArray(topics) ? topics : topics.results
  } catch {
    /* 各区块相互独立，失败时交给空状态兜底 */
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="container home">
    <!-- 欢迎区 -->
    <section class="welcome rise-in">
      <h1 class="welcome__title">地理学学习资料共享</h1>
      <p class="welcome__desc">
        汇集自然地理、人文地理、GIS 遥感、区域地理与地质地貌的课件、笔记与真题，
        支持上传、检索、收藏与讨论。
      </p>
      <div class="welcome__actions">
        <RouterLink class="btn btn--primary" :to="{ name: 'materials' }">
          浏览资料库
          <AppIcon name="arrowRight" :size="16" />
        </RouterLink>
        <RouterLink class="btn btn--secondary" :to="{ name: 'upload' }">
          <AppIcon name="upload" :size="16" />
          上传资料
        </RouterLink>
      </div>
      <p class="welcome__stat num">
        现有资料 {{ totalMaterials }} 份 · 分类 {{ categories.length }} 个
      </p>
    </section>

    <!-- 热门下载：横向滚动卡片组 -->
    <section class="section">
      <div class="section-head">
        <h2>
          热门下载
          <span class="section-head__hint">按下载量排序</span>
        </h2>
        <RouterLink
          class="section-head__more"
          :to="{ name: 'materials', query: { ordering: 'downloads' } }"
        >
          查看全部
          <AppIcon name="chevronRight" :size="14" />
        </RouterLink>
      </div>

      <div v-if="loading" class="scroll-x">
        <SkeletonCard v-for="index in 4" :key="index" class="scroll-x__item" />
      </div>
      <div v-else-if="hotMaterials.length" class="scroll-x">
        <MaterialCard
          v-for="item in hotMaterials"
          :key="item.id"
          :material="item"
          horizontal
          class="scroll-x__item"
        />
      </div>
      <EmptyState
        v-else
        title="还没有下载记录"
        description="上传第一份资料后，这里会显示下载排行。"
      />
    </section>

    <!-- 热门讨论：回复量最高的论坛帖子 -->
    <section class="section">
      <div class="section-head">
        <h2>
          热门讨论
          <span class="section-head__hint">按回复数排序</span>
        </h2>
        <RouterLink class="section-head__more" :to="{ name: 'forum' }">
          进入论坛
          <AppIcon name="chevronRight" :size="14" />
        </RouterLink>
      </div>

      <div v-if="loading" class="topic-grid">
        <SkeletonCard v-for="index in 2" :key="index" />
      </div>
      <div v-else-if="hotTopics.length" class="topic-grid">
        <TopicCard v-for="item in hotTopics" :key="item.id" :topic="item" />
      </div>
      <EmptyState
        v-else
        title="论坛还没有讨论"
        description="去论坛发第一帖，和大家聊聊学习中的问题。"
      >
        <template #action>
          <RouterLink class="btn btn--primary" :to="{ name: 'forum' }">进入论坛</RouterLink>
        </template>
      </EmptyState>
    </section>

    <div class="home__columns">
      <!-- 最新上传 -->
      <section class="section home__main">
        <div class="section-head">
          <h2>最新上传</h2>
          <RouterLink class="section-head__more" :to="{ name: 'materials' }">
            查看全部
            <AppIcon name="chevronRight" :size="14" />
          </RouterLink>
        </div>
        <div v-if="loading" class="grid grid--3">
          <SkeletonCard v-for="index in 6" :key="index" />
        </div>
        <div v-else-if="latestMaterials.length" class="grid grid--3">
          <MaterialCard v-for="item in latestMaterials" :key="item.id" :material="item" />
        </div>
        <EmptyState
          v-else
          title="资料库还是空的"
          description="成为第一个分享资料的人，把课件或笔记传上来。"
        >
          <template #action>
            <RouterLink class="btn btn--primary" :to="{ name: 'upload' }">上传资料</RouterLink>
          </template>
        </EmptyState>
      </section>

      <!-- 侧边栏：分类导航 + 热门标签 -->
      <aside class="home__side">
        <div class="card side-card">
          <h3 class="side-card__title">资料分类</h3>
          <ul class="cat-list">
            <li v-for="item in categories" :key="item.slug">
              <RouterLink
                class="cat-list__item"
                :to="{ name: 'materials', query: { category: item.slug } }"
              >
                <AppIcon :name="categoryIcon(item.slug)" :size="16" />
                <span class="cat-list__name">{{ item.name }}</span>
                <span class="cat-list__count num">{{ item.material_count }}</span>
              </RouterLink>
            </li>
          </ul>
        </div>

        <div class="card side-card">
          <h3 class="side-card__title">热门标签</h3>
          <div v-if="hotTags.length" class="tag-cloud">
            <RouterLink
              v-for="tag in hotTags"
              :key="tag.id"
              class="pill"
              :to="{ name: 'materials', query: { tag: tag.name } }"
            >
              {{ tag.name }}
            </RouterLink>
          </div>
          <p v-else class="text-small text-muted">暂无标签</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.home {
  padding-top: 32px;
  padding-bottom: 24px;
}

.welcome {
  padding: 8px 0 28px;
}

.welcome__title {
  margin-bottom: 8px;
}

.welcome__desc {
  max-width: 640px;
  color: var(--text-2);
}

.welcome__actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.welcome__stat {
  margin-top: 14px;
  color: var(--text-3);
  font-size: var(--fs-small);
}

.section-head__hint {
  margin-left: 8px;
  color: var(--text-3);
  font-size: var(--fs-small);
  font-weight: 400;
}

.section-head__more {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--fs-small);
}

.home__columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 24px;
  align-items: start;
}

.grid {
  display: grid;
  gap: 16px;
}

.grid--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.topic-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.scroll-x__item {
  flex: none;
  width: 268px;
}

.home__side {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: calc(var(--nav-height) + 24px);
}

.side-card__title {
  margin-bottom: 12px;
}

.cat-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cat-list__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  color: var(--text-2);
  font-size: var(--fs-h4);
  transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
}

.cat-list__item:hover {
  background: var(--bg-hover);
  color: var(--color-primary);
  text-decoration: none;
}

.cat-list__name {
  flex: 1;
}

.cat-list__count {
  color: var(--text-3);
  font-size: var(--fs-small);
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 1280px) {
  .grid--3 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1024px) {
  .home__columns {
    grid-template-columns: minmax(0, 1fr);
  }

  .home__side {
    position: static;
  }

  .grid--3 {
    grid-template-columns: minmax(0, 1fr);
  }

  .topic-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

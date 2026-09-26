<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { api } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import HeroCarousel from '@/components/HeroCarousel.vue'
import MaterialCard from '@/components/MaterialCard.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import TopicCard from '@/components/TopicCard.vue'
import { categoryIcon } from '@/utils/format'

const categories = ref([])
const hotTags = ref([])
// 分类 → 该分类下的标签，用于首页侧栏「分类 + 标签」两级导航
const categoryTags = ref({})
const hotMaterials = ref([])
const latestMaterials = ref([])
const hotTopics = ref([])
const loading = ref(true)

// 网站介绍里的功能点：都是已经实现的能力，不写没做的
const FEATURES = [
  {
    icon: 'upload',
    title: '资料共享与审核',
    desc: 'PDF / Word / PPT 一键上传，管理员审核通过后公开，支持分类、标签与全文检索。',
  },
  {
    icon: 'comment',
    title: '论坛与楼层回复',
    desc: '按六个地学板块发帖讨论，支持 Markdown、二级回复、置顶加精与站内通知。',
  },
  {
    icon: 'heart',
    title: '收藏与个人中心',
    desc: '收藏资料、管理自己的上传与评论、查看下载记录，进度一目了然。',
  },
  {
    icon: 'globe',
    title: '深浅双主题',
    desc: '白天黑夜自动适配的简约学术排版，专注阅读，手机上也能顺畅浏览。',
  },
]

const totalMaterials = computed(() =>
  categories.value.reduce((sum, item) => sum + (item.material_count || 0), 0),
)

onMounted(async () => {
  try {
    const [categoryList, tagList, allTags, hot, latest, topics] = await Promise.all([
      api.categories(),
      api.hotTags(10),
      api.tags(),
      api.hotMaterials(),
      api.latestMaterials(),
      api.topics({ ordering: 'hot', page_size: 5 }),
    ])
    categories.value = categoryList
    // 热门标签在冷启动期/新站可能为空，这时回落到全部标签（按分类整理过的那批）
    hotTags.value = tagList.length ? tagList : allTags.slice(0, 12)
    categoryTags.value = allTags.reduce((acc, tag) => {
      if (tag.category_slug) {
        acc[tag.category_slug] = [...(acc[tag.category_slug] || []), tag]
      }
      return acc
    }, {})
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
    <!-- 主题大图轮播：等高线山体 / 遥感网格 / 城市与人口 / 岩层剖面 -->
    <HeroCarousel class="rise-in" />

    <!-- 网站介绍 + 功能介绍 -->
    <section class="section intro rise-in">
      <div class="intro__head">
        <h2 class="section__title">关于本站</h2>
        <p class="intro__stat num">
          现有资料 {{ totalMaterials }} 份 · 分类 {{ categories.length }} 个
        </p>
      </div>
      <p class="intro__text">
        这是一个面向地理学专业的学习资料共享平台：把散落在网盘、聊天记录里的课件、笔记、真题
        集中起来，按自然地理、人文地理、GIS 遥感、区域地理、地质地貌归类，
        配上讨论区，让找资料和问问题都只用几分钟。
      </p>
      <div class="features">
        <article v-for="item in FEATURES" :key="item.title" class="card feature">
          <span class="feature__icon">
            <AppIcon :name="item.icon" :size="18" />
          </span>
          <h3 class="feature__title">{{ item.title }}</h3>
          <p class="feature__desc">{{ item.desc }}</p>
        </article>
      </div>
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
              <!-- 分类下的常用标签，点进去直接带上「分类 + 标签」两个条件 -->
              <div v-if="categoryTags[item.slug]?.length" class="cat-list__tags">
                <RouterLink
                  v-for="tag in categoryTags[item.slug].slice(0, 6)"
                  :key="tag.id"
                  class="cat-list__tag"
                  :to="{ name: 'materials', query: { category: item.slug, tag: tag.name } }"
                >
                  {{ tag.name }}
                </RouterLink>
              </div>
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

.intro {
  padding: 22px 24px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
}

.intro__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.intro__stat {
  color: var(--text-3);
  font-size: var(--fs-small);
}

.intro__text {
  max-width: 760px;
  margin: 10px 0 20px;
  color: var(--text-2);
  line-height: var(--lh-body);
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.feature {
  padding: 18px 18px 20px;
  transition: box-shadow var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease);
}

.feature:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}

.feature__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.feature__title {
  margin: 12px 0 6px;
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
}

.feature__desc {
  margin: 0;
  color: var(--text-2);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
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

/* 分类下的标签：小一号、浅色，点进去带上「分类 + 标签」两个筛选条件 */
.cat-list__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 2px 0 6px 34px;
}

.cat-list__tag {
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 12px;
  line-height: 1.6;
  text-decoration: none;
  transition: background-color var(--dur-fast) var(--ease);
}

.cat-list__tag:hover {
  background: var(--bg-hover);
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

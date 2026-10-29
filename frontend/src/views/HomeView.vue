<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { api } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import HeroCarousel from '@/components/HeroCarousel.vue'
import HomeLabShowcase from '@/components/HomeLabShowcase.vue'
import MaterialCard from '@/components/MaterialCard.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import TopicCard from '@/components/TopicCard.vue'

const categories = ref([])
const hotMaterials = ref([])
const latestMaterials = ref([])
const hotTopics = ref([])
const loading = ref(true)

const SITE_FEATURES = [
  {
    icon: 'folder',
    title: '资料分享',
    desc: '按分类和标签检索课件、笔记、真题与地理数据。登录后可下载、收藏、评论或上传资料。',
  },
  {
    icon: 'comment',
    title: '论坛',
    desc: '按板块浏览和发布讨论，支持楼层回复、图片附件、置顶与站内通知。',
  },
  {
    icon: 'layers',
    title: '可视化实验室',
    desc: '提供杜能环、Dijkstra 最短路径与大气水平运动受力三套浏览器交互实验。',
  },
]

const totalMaterials = computed(() =>
  categories.value.reduce((sum, item) => sum + (item.material_count || 0), 0),
)

onMounted(async () => {
  try {
    const [categoryList, hot, latest, topics] = await Promise.all([
      api.categories(),
      api.hotMaterials(),
      api.latestMaterials(),
      api.topics({ ordering: 'hot', page_size: 2 }),
    ])
    categories.value = categoryList
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
    <!-- 主要板块轮播：资料分享 / 论坛 / 可视化实验室 -->
    <HeroCarousel class="rise-in" />

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

    <!-- 最新上传 -->
    <section class="section">
      <div class="section-head">
        <h2>最新上传</h2>
        <RouterLink class="section-head__more" :to="{ name: 'materials' }">
          查看全部
          <AppIcon name="chevronRight" :size="14" />
        </RouterLink>
      </div>
      <div v-if="loading" class="scroll-x">
        <SkeletonCard v-for="index in 4" :key="index" />
      </div>
      <div v-else-if="latestMaterials.length" class="scroll-x">
        <MaterialCard
          v-for="item in latestMaterials.slice(0, 4)"
          :key="item.id"
          :material="item"
          horizontal
          class="scroll-x__item"
        />
      </div>
      <EmptyState
        v-else
        title="资料分享区还是空的"
        description="上传第一份资料后，这里会显示最近提交的内容。"
      >
        <template #action>
          <RouterLink class="btn btn--primary" :to="{ name: 'upload' }">上传资料</RouterLink>
        </template>
      </EmptyState>
    </section>

    <HomeLabShowcase class="rise-in" />

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
        description="进入论坛后可以查看板块和发帖入口。"
      >
        <template #action>
          <RouterLink class="btn btn--primary" :to="{ name: 'forum' }">进入论坛</RouterLink>
        </template>
      </EmptyState>
    </section>

    <section class="section intro rise-in" aria-labelledby="about-title">
      <div class="intro__head">
        <div>
          <span class="intro__kicker">关于本站</span>
          <h2 id="about-title">面向地理学学习与教学的资料与实验平台</h2>
        </div>
        <p class="intro__stat num">已收录资料 {{ totalMaterials }} 份</p>
      </div>

      <p class="intro__text">
        GeoHub 将学习资料整理、课程讨论和地理可视化实验放在同一个网站中。各功能使用独立页面，
        资料与讨论数据由站内账户、审核和通知系统管理。
      </p>

      <div class="intro__features">
        <article v-for="item in SITE_FEATURES" :key="item.title">
          <span class="intro__feature-icon">
            <AppIcon :name="item.icon" :size="18" />
          </span>
          <h3>{{ item.title }}</h3>
          <p>{{ item.desc }}</p>
        </article>
      </div>

      <p class="intro__note">
        游客可以浏览公开资料与论坛内容；下载、评论、发帖和上传需要登录。用户提交的资料经管理员审核后公开。
      </p>
    </section>
  </div>
</template>

<style scoped>
.home {
  padding-top: 32px;
  padding-bottom: 24px;
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

.topic-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.scroll-x__item {
  flex: none;
  width: 268px;
}

.intro {
  padding: 28px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
}

.intro__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.intro__kicker {
  display: block;
  margin-bottom: 7px;
  color: var(--color-secondary);
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
}

.intro__head h2 {
  max-width: 680px;
  font-size: clamp(23px, 2.5vw, 30px);
  line-height: 1.35;
  letter-spacing: -0.02em;
  text-wrap: balance;
}

.intro__stat {
  flex: none;
  color: var(--text-3);
  font-size: var(--fs-small);
}

.intro__text {
  max-width: 900px;
  margin-top: 18px;
  color: var(--text-2);
  line-height: var(--lh-body);
  text-wrap: pretty;
}

.intro__features {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px;
  margin-top: 24px;
}

.intro__features article {
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.intro__feature-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 50%;
  color: var(--color-primary);
}

.intro__features h3 {
  margin-top: 10px;
  font-size: var(--fs-h3);
}

.intro__features p {
  margin-top: 6px;
  color: var(--text-2);
  font-size: var(--fs-small);
  line-height: var(--lh-body);
  text-wrap: pretty;
}

.intro__note {
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  color: var(--text-3);
  font-size: var(--fs-small);
  text-wrap: pretty;
}

@media (max-width: 1024px) {
  .topic-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 680px) {
  .home {
    padding-top: 20px;
  }

  .intro {
    padding: 20px;
  }

  .intro__head {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .intro__features {
    grid-template-columns: 1fr;
    gap: 18px;
  }

}
</style>

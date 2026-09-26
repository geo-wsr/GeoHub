<script setup>
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { api, errorMessage } from '@/api'
import { authState } from '@/stores/auth'
import { pushToast } from '@/stores/toast'
import { categoryIcon, compactNumber, fileLabel, formatDay } from '@/utils/format'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  material: { type: Object, required: true },
  /** 横向卡片：用于首页「热门下载」左右滚动区 */
  horizontal: { type: Boolean, default: false },
})

const router = useRouter()
const busy = ref(false)

const iconName = computed(() => categoryIcon(props.material.category?.slug))

/** 收藏/取消收藏：未登录时引导到登录页 */
async function toggleFavorite() {
  if (!authState.user) {
    pushToast('登录后即可收藏', 'info')
    router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
    return
  }
  if (busy.value) return
  busy.value = true
  try {
    const result = await api.toggleFavorite(props.material.id)
    props.material.is_favorited = result.is_favorited
    props.material.favorite_count = result.favorite_count
    pushToast(result.is_favorited ? '已加入收藏' : '已取消收藏', 'success')
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <article class="m-card card" :class="{ 'm-card--horizontal': horizontal }">
    <div class="m-card__top">
      <span class="m-card__cat">
        <AppIcon :name="iconName" :size="14" />
        {{ material.category?.name }}
      </span>
      <span class="m-card__ext">{{ fileLabel(material.file_ext) }}</span>
      <span v-if="material.is_external" class="m-card__ext m-card__ext--link">外链</span>
    </div>

    <RouterLink
      class="m-card__title"
      :to="{ name: 'material-detail', params: { id: material.id } }"
    >
      {{ material.title }}
    </RouterLink>

    <p class="m-card__desc">{{ material.description || '暂无简介' }}</p>

    <div class="m-card__tags">
      <RouterLink
        v-for="tag in material.tags.slice(0, 3)"
        :key="tag.id"
        class="pill pill--ghost"
        :to="{ name: 'materials', query: { tag: tag.name } }"
      >
        {{ tag.name }}
      </RouterLink>
    </div>

    <div class="m-card__foot">
      <span class="m-card__stat" :title="`下载 ${material.download_count} 次`">
        <AppIcon name="download" :size="14" />
        {{ compactNumber(material.download_count) }}
      </span>
      <span class="m-card__stat" :title="`评论 ${material.comment_count} 条`">
        <AppIcon name="comment" :size="14" />
        {{ compactNumber(material.comment_count) }}
      </span>
      <time class="m-card__date">{{ formatDay(material.created_at) }}</time>
      <button
        class="m-card__fav"
        :class="{ 'is-on': material.is_favorited }"
        type="button"
        :disabled="busy"
        :aria-label="material.is_favorited ? '取消收藏' : '收藏'"
        :title="material.is_favorited ? '取消收藏' : '收藏'"
        @click.prevent="toggleFavorite"
      >
        <AppIcon :name="material.is_favorited ? 'heartFilled' : 'heart'" :size="16" />
      </button>
    </div>
  </article>
</template>

<style scoped>
.m-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  height: 100%;
}

.m-card:hover {
  /* 悬浮：上移 2px + 阴影加深 */
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}

.m-card--horizontal {
  width: 268px;
  flex: none;
}

.m-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.m-card__cat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  /* 分类标签：主色淡色底 + 主色文字 */
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: var(--fs-small);
  line-height: 1.7;
}

.m-card__ext {
  color: var(--text-3);
  font-family: var(--font-latin);
  font-size: var(--fs-small);
  letter-spacing: 0.04em;
}

/* 外链资料标记：文件不在本站，靠 CDN 分发 */
.m-card__ext--link {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: var(--radius-pill);
  background: var(--color-accent-soft);
  color: var(--color-accent);
  letter-spacing: 0;
}

.m-card__title {
  color: var(--text-1);
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
  line-height: var(--lh-title);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.m-card__title:hover {
  color: var(--color-primary);
}

.m-card__desc {
  color: var(--text-2);
  font-size: var(--fs-small);
  line-height: var(--lh-body);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 38px;
}

.m-card__tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  min-height: 22px;
}

.m-card__foot {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  color: var(--text-3);
  font-size: var(--fs-small);
}

.m-card__stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.m-card__date {
  margin-left: auto;
}

.m-card__fav {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--text-3);
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease), background-color var(--dur-fast) var(--ease);
}

.m-card__fav:hover {
  background: var(--bg-hover);
  color: var(--color-accent);
}

.m-card__fav.is-on {
  /* 收藏高亮使用强调色 */
  color: var(--color-accent);
}
</style>

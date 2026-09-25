<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { categoryIcon, compactNumber, formatDay } from '@/utils/format'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  topic: { type: Object, required: true },
})

// 板块图标复用资料分类的线性图标映射
const iconName = computed(() => categoryIcon(props.topic.board?.slug))
</script>

<template>
  <article class="t-card card">
    <div class="t-card__top">
      <RouterLink
        class="t-card__board"
        :to="{ name: 'forum', query: { board: topic.board?.slug } }"
      >
        <AppIcon :name="iconName" :size="14" />
        {{ topic.board?.name }}
      </RouterLink>
      <span class="t-card__badges">
        <span v-if="topic.is_pinned" class="badge badge--pin">置顶</span>
        <span v-if="topic.is_featured" class="badge badge--feature">精华</span>
      </span>
      <time class="t-card__date">{{ formatDay(topic.created_at) }}</time>
    </div>

    <RouterLink class="t-card__title" :to="{ name: 'topic-detail', params: { id: topic.id } }">
      {{ topic.title }}
    </RouterLink>

    <p class="t-card__summary">{{ topic.summary }}</p>

    <div v-if="topic.tags?.length" class="t-card__tags">
      <RouterLink
        v-for="tag in topic.tags.slice(0, 3)"
        :key="tag.id"
        class="pill pill--ghost"
        :to="{ name: 'forum', query: { tag: tag.name } }"
      >
        {{ tag.name }}
      </RouterLink>
    </div>

    <div class="t-card__foot">
      <span class="t-card__author">
        <AppIcon name="user" :size="14" />
        {{ topic.author?.display_name }}
      </span>
      <span class="t-card__stat" :title="`回复 ${topic.reply_count} 条`">
        <AppIcon name="comment" :size="14" />
        {{ compactNumber(topic.reply_count) }}
      </span>
      <span class="t-card__stat" :title="`浏览 ${topic.views} 次`">
        <AppIcon name="eye" :size="14" />
        {{ compactNumber(topic.views) }}
      </span>
    </div>
  </article>
</template>

<style scoped>
.t-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
}

.t-card:hover {
  /* 与资料卡片一致的悬浮反馈 */
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}

.t-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.t-card__board {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: var(--fs-small);
  line-height: 1.7;
}

.t-card__date {
  color: var(--text-3);
  font-size: var(--fs-small);
}

.t-card__badges {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.t-card__badges:empty {
  display: none;
}

.t-card__title {
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

.t-card__title:hover {
  color: var(--color-primary);
}

.t-card__summary {
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

.t-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.t-card__foot {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  color: var(--text-3);
  font-size: var(--fs-small);
}

.t-card__author {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.t-card__stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>

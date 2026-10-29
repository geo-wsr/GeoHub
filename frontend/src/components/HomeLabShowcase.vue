<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { useTheme } from '@/stores/theme'
import { LAB_GROUPS } from '@/visualization/catalog'
import AppIcon from './AppIcon.vue'

const theme = useTheme()

const labs = computed(() =>
  LAB_GROUPS.flatMap((group) =>
    group.labs.map((lab) => ({
      ...lab,
      groupTitle: group.title,
    })),
  ),
)
</script>

<template>
  <section class="section home-labs" aria-labelledby="home-labs-title">
    <header class="home-labs__head">
      <div>
        <span class="home-labs__kicker">浏览器内交互实验</span>
        <h2 id="home-labs-title">可视化实验室</h2>
        <p>提供三套可调整参数、实时查看结果的交互实验，覆盖人文地理、GIS 与自然地理。</p>
      </div>
      <RouterLink class="home-labs__more" :to="{ name: 'visualization' }">
        查看全部实验
        <AppIcon name="chevronRight" :size="15" />
      </RouterLink>
    </header>

    <div class="home-labs__grid">
      <RouterLink
        v-for="lab in labs"
        :key="lab.id"
        class="home-lab-card"
        :to="{ name: 'visualization-lab', params: { lab: lab.id } }"
      >
        <span class="home-lab-card__media">
          <img
            :src="theme.mode === 'dark' ? lab.imageDark : lab.image"
            :alt="lab.imageAlt"
            loading="lazy"
          />
        </span>
        <span class="home-lab-card__body">
          <span class="home-lab-card__meta">{{ lab.groupTitle }} · {{ lab.subtitle }}</span>
          <strong class="home-lab-card__title">{{ lab.title }}</strong>
          <span class="home-lab-card__desc">{{ lab.description }}</span>
          <span class="home-lab-card__tags">
            <span v-for="tag in lab.tags" :key="tag">{{ tag }}</span>
          </span>
          <span class="home-lab-card__action">
            进入实验
            <AppIcon name="arrowRight" :size="15" />
          </span>
        </span>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.home-labs {
  margin-top: 44px;
  padding: 28px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background:
    radial-gradient(circle at 92% 4%, var(--color-primary-soft), transparent 34%),
    var(--bg-card);
}

.home-labs__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;
}

.home-labs__kicker {
  display: block;
  margin-bottom: 7px;
  color: var(--color-secondary);
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
}

.home-labs__head h2 {
  font-size: 30px;
  letter-spacing: -0.025em;
}

.home-labs__head p {
  max-width: 680px;
  margin-top: 8px;
  color: var(--text-2);
  text-wrap: pretty;
}

.home-labs__more {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 3px;
  padding-bottom: 4px;
  font-size: var(--fs-small);
}

.home-labs__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.home-lab-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
  color: var(--text-1);
  transition:
    transform var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease),
    box-shadow var(--dur-fast) var(--ease);
}

.home-lab-card:hover {
  transform: translateY(-3px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-card-hover);
  color: var(--text-1);
  text-decoration: none;
}

.home-lab-card:focus-visible {
  outline: 3px solid var(--color-secondary);
  outline-offset: 3px;
}

.home-lab-card__media {
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: var(--bg-hover);
  border-bottom: 1px solid var(--border);
}

.home-lab-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  transition: transform 0.45s var(--ease);
}

.home-lab-card:hover .home-lab-card__media img {
  transform: scale(1.018);
}

.home-lab-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 18px;
}

.home-lab-card__meta {
  color: var(--color-secondary);
  font-size: 12px;
  font-weight: var(--fw-medium);
}

.home-lab-card__title {
  margin-top: 5px;
  font-size: 19px;
  line-height: 1.35;
}

.home-lab-card__desc {
  display: -webkit-box;
  margin-top: 8px;
  overflow: hidden;
  color: var(--text-2);
  font-size: var(--fs-small);
  line-height: 1.75;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

.home-lab-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 14px;
}

.home-lab-card__tags span {
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 11px;
}

.home-lab-card__action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: auto;
  padding-top: 16px;
  color: var(--color-primary);
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
}

@media (max-width: 960px) {
  .home-labs__grid {
    grid-template-columns: 1fr;
  }

  .home-lab-card {
    display: grid;
    grid-template-columns: minmax(220px, 0.9fr) minmax(0, 1.1fr);
  }

  .home-lab-card__media {
    height: 100%;
    aspect-ratio: auto;
    border-right: 1px solid var(--border);
    border-bottom: 0;
  }
}

@media (max-width: 680px) {
  .home-labs {
    margin-top: 34px;
    padding: 20px;
  }

  .home-labs__head {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .home-labs__head h2 {
    font-size: 26px;
  }

  .home-labs__grid {
    display: flex;
    gap: 12px;
    margin-right: -20px;
    padding-right: 20px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: thin;
  }

  .home-lab-card {
    flex: 0 0 82%;
    display: flex;
    scroll-snap-align: start;
  }

  .home-lab-card__media {
    aspect-ratio: 16 / 10;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-lab-card,
  .home-lab-card__media img {
    transition: none;
  }

  .home-lab-card:hover,
  .home-lab-card:hover .home-lab-card__media img {
    transform: none;
  }
}
</style>

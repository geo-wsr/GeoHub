<script setup>
import { RouterLink } from 'vue-router'

import AppIcon from '@/components/AppIcon.vue'
import { useTheme } from '@/stores/theme'
import { LAB_GROUPS } from '@/visualization/catalog'

const theme = useTheme()
</script>

<template>
  <div class="container visualization-page">
    <header class="visualization-hero">
      <div class="visualization-hero__copy">
        <h1>可视化实验室</h1>
        <p>
          把地理模型变成可以修改、运行和解释的交互实验。按自然地理、人文地理与 GIS与遥感三个方向进入，
          每次操作都会同步改变地图、图表或算法状态。
        </p>
      </div>
      <div class="visualization-hero__note">
        <AppIcon name="layers" :size="20" />
        <span>浏览器实时计算</span>
        <small>无需安装，不依赖额外数据接口</small>
      </div>
    </header>

    <nav class="lab-jump" aria-label="实验室分类">
      <a v-for="group in LAB_GROUPS" :key="group.key" :href="`#${group.key}`">
        <AppIcon :name="group.icon" :size="16" />
        {{ group.title }}
        <span class="num">{{ String(group.labs.length).padStart(2, '0') }}</span>
      </a>
    </nav>

    <section
      v-for="group in LAB_GROUPS"
      :id="group.key"
      :key="group.key"
      class="lab-group"
      :class="`lab-group--${group.key}`"
      :aria-labelledby="`${group.key}-title`"
    >
      <header class="lab-group__head">
        <span class="lab-group__icon">
          <AppIcon :name="group.icon" :size="22" />
        </span>
        <div>
          <h2 :id="`${group.key}-title`">{{ group.title }}</h2>
          <p>{{ group.description }}</p>
        </div>
        <span class="lab-group__en">{{ group.english }}</span>
      </header>

      <div class="lab-list">
        <RouterLink
          v-for="lab in group.labs"
          :key="lab.id"
          class="lab-card"
          :to="{ name: 'visualization-lab', params: { lab: lab.id } }"
          :aria-label="`进入${lab.title}实验室`"
        >
          <span class="lab-card__visual">
            <img
              :src="theme.mode === 'dark' ? lab.imageDark : lab.image"
              :alt="lab.imageAlt"
              loading="lazy"
            />
            <span class="lab-card__open">
              进入实验
              <AppIcon name="arrowRight" :size="15" />
            </span>
          </span>
          <span class="lab-card__body">
            <span class="lab-card__kicker">{{ lab.subtitle }}</span>
            <strong class="lab-card__title">{{ lab.title }}</strong>
            <span class="lab-card__description">{{ lab.description }}</span>
            <span class="lab-card__tags">
              <span v-for="tag in lab.tags" :key="tag">{{ tag }}</span>
            </span>
          </span>
        </RouterLink>
      </div>

      <p class="lab-group__future">更多{{ group.title }}实验将持续加入。</p>
    </section>

    <footer class="visualization-footer">
      <div>
        <h2>从一个变量开始</h2>
        <p>选择一个实验，改变参数并观察结果如何相应变化。</p>
      </div>
      <div class="visualization-footer__actions">
        <RouterLink class="btn btn--secondary" :to="{ name: 'materials' }">浏览资料分享</RouterLink>
        <RouterLink class="btn btn--primary" :to="{ name: 'home' }">返回首页</RouterLink>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.visualization-page {
  padding-top: 32px;
  padding-bottom: 16px;
}

.visualization-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 32px;
  align-items: end;
  padding: 30px 0 32px;
  border-bottom: 1px solid var(--border);
}

.visualization-hero h1 {
  font-size: clamp(34px, 5vw, 58px);
  line-height: 1.08;
  letter-spacing: -0.035em;
  text-wrap: balance;
}

.visualization-hero__copy p {
  max-width: 720px;
  margin-top: 18px;
  color: var(--text-2);
  font-size: var(--fs-h3);
  line-height: 1.8;
  text-wrap: pretty;
}

.visualization-hero__note {
  display: grid;
  gap: 7px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.visualization-hero__note span {
  color: var(--text-1);
  font-weight: var(--fw-semibold);
}

.visualization-hero__note small {
  line-height: 1.6;
}

.lab-jump {
  display: flex;
  gap: 8px;
  padding: 20px 0;
  overflow-x: auto;
  scrollbar-width: thin;
}

.lab-jump a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--bg-card);
  color: var(--text-2);
  white-space: nowrap;
}

.lab-jump a:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  text-decoration: none;
}

.lab-jump .num {
  color: var(--text-3);
  font-size: 11px;
}

.lab-group {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  gap: 32px;
  padding: 38px 0;
  border-top: 1px solid var(--border);
  scroll-margin-top: calc(var(--nav-height) + 20px);
}

.lab-group__head {
  position: sticky;
  top: calc(var(--nav-height) + 24px);
  align-self: start;
}

.lab-group__icon {
  display: grid;
  width: 42px;
  height: 42px;
  margin-bottom: 16px;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--bg-card);
  color: var(--color-primary);
}

.lab-group__head h2 {
  font-size: 28px;
  letter-spacing: -0.02em;
}

.lab-group__head p {
  margin-top: 10px;
  color: var(--text-2);
  line-height: 1.75;
}

.lab-group__en {
  display: block;
  margin-top: 18px;
  color: var(--text-3);
  font-family: var(--font-latin);
  font-size: 10px;
  letter-spacing: 0.08em;
}

.lab-list {
  display: grid;
  gap: 16px;
}

.lab-card {
  display: grid;
  grid-template-columns: minmax(240px, 0.9fr) minmax(260px, 1.1fr);
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

.lab-card:hover {
  transform: translateY(-3px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-card-hover);
  color: var(--text-1);
  text-decoration: none;
}

.lab-card:focus-visible {
  outline: 3px solid var(--color-secondary);
  outline-offset: 3px;
}

.lab-card__visual {
  position: relative;
  min-height: 280px;
  overflow: hidden;
  background: var(--bg-hover);
}

.lab-card__visual img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  transition: transform 0.45s var(--ease);
}

.lab-card:hover .lab-card__visual img {
  transform: scale(1.018);
}

.lab-card__open {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: var(--radius-pill);
  background: rgba(20, 28, 34, 0.78);
  color: #fff;
  font-size: var(--fs-small);
  backdrop-filter: blur(8px);
}

.lab-card__body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 28px;
}

.lab-card__kicker {
  margin-bottom: 8px;
  color: var(--color-secondary);
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
}

.lab-card__title {
  font-size: 25px;
  line-height: 1.25;
}

.lab-card__description {
  margin-top: 12px;
  color: var(--text-2);
  line-height: 1.75;
  text-wrap: pretty;
}

.lab-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 18px;
}

.lab-card__tags span {
  padding: 2px 9px;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 11px;
}

.lab-group__future {
  grid-column: 2;
  color: var(--text-3);
  font-size: var(--fs-small);
}

.visualization-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-top: 16px;
  padding: 28px 0 36px;
  border-top: 1px solid var(--border);
}

.visualization-footer h2 {
  font-size: 25px;
}

.visualization-footer p {
  margin-top: 6px;
  color: var(--text-2);
}

.visualization-footer__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

@media (max-width: 900px) {
  .visualization-hero {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .visualization-hero__note {
    max-width: 420px;
  }

  .lab-group {
    grid-template-columns: 1fr;
    gap: 22px;
  }

  .lab-group__head {
    position: static;
    display: grid;
    grid-template-columns: 42px 1fr;
    column-gap: 14px;
  }

  .lab-group__icon {
    grid-row: 1 / 3;
    margin-bottom: 0;
  }

  .lab-group__en {
    display: none;
  }

  .lab-group__future {
    grid-column: 1;
  }
}

@media (max-width: 680px) {
  .visualization-page {
    padding-top: 20px;
  }

  .visualization-hero {
    gap: 20px;
    padding-top: 20px;
  }

  .lab-card {
    grid-template-columns: 1fr;
  }

  .lab-card__visual {
    min-height: 210px;
  }

  .lab-card__body {
    padding: 20px;
  }

  .visualization-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .visualization-footer__actions {
    width: 100%;
  }
}
</style>

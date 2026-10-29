<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import AppIcon from './AppIcon.vue'

/**
 * 首页主要板块轮播。
 *
 * 三张卡片分别对应资料分享、论坛和可视化实验室。
 * 插画用内联 SVG 画（不是位图）：任意分辨率都清晰、体积几乎为零，
 * 颜色全部走设计令牌，浅色/深色主题切换时自动适配。
 * 交互：自动播放（6s）+ 左右箭头 + 圆点 + 触摸/鼠标左右滑动；
 * 悬停、页面不可见、系统偏好"减少动效"时都会暂停自动播放。
 */
const SLIDES = [
  {
    key: 'materials',
    eyebrow: '资料分享',
    title: '把散落的地理资料，整理成可复用的学习目录',
    desc: '课件、笔记、真题与地理数据按自然地理、人文地理和 GIS与遥感归类，支持标签检索、收藏与下载记录。',
    cta: '进入资料分享',
    to: { name: 'materials' },
    bg: 'linear-gradient(135deg, var(--color-primary-soft), var(--bg-card) 62%)',
  },
  {
    key: 'forum',
    eyebrow: '论坛',
    title: '把一个问题，变成一轮可以继续积累的讨论',
    desc: '按地学方向发帖和交流，支持图片附件、楼层回复、置顶加精与站内通知，让答案留在可检索的社区里。',
    cta: '进入论坛',
    to: { name: 'forum' },
    bg: 'linear-gradient(135deg, var(--color-secondary-soft), var(--bg-card) 62%)',
  },
  {
    key: 'lab',
    eyebrow: '可视化实验室',
    title: '让空间模型在参数改变时被看见',
    desc: '从人文区位到大气受力，再到 GIS与遥感网络分析，用可编辑模型、实时地图和图表解释地理过程。',
    cta: '进入可视化实验室',
    to: { name: 'visualization' },
    bg: 'linear-gradient(135deg, var(--color-accent-soft), var(--bg-card) 62%)',
  },
]

const index = ref(0)
const paused = ref(false)
const total = SLIDES.length
const current = computed(() => SLIDES[index.value])

let timer = null
let swipeStartX = null
const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function go(target) {
  index.value = (target + total) % total
}

function next() {
  go(index.value + 1)
}

function prev() {
  go(index.value - 1)
}

function startTimer() {
  stopTimer()
  if (reducedMotion || paused.value) return
  timer = window.setInterval(() => {
    if (!document.hidden) next()
  }, 6000)
}

function stopTimer() {
  if (timer) window.clearInterval(timer)
  timer = null
}

function onVisibility() {
  if (document.hidden) stopTimer()
  else startTimer()
}

// —— 触摸/鼠标滑动 ——
function onPointerDown(event) {
  swipeStartX = event.clientX
}

function onPointerUp(event) {
  if (swipeStartX === null) return
  const delta = event.clientX - swipeStartX
  swipeStartX = null
  if (Math.abs(delta) < 40) return
  delta < 0 ? next() : prev()
}

onMounted(() => {
  startTimer()
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  stopTimer()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <section
    class="hero"
    role="region"
    aria-roledescription="carousel"
    aria-label="泉盒子的GeoHub主要板块"
    @mouseenter="paused = true; stopTimer()"
    @mouseleave="paused = false; startTimer()"
    @focusin="paused = true; stopTimer()"
    @focusout="paused = false; startTimer()"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
  >
    <div class="hero__track" :style="{ transform: `translateX(-${index * 100}%)` }">
      <article
        v-for="(slide, i) in SLIDES"
        :key="slide.key"
        class="hero__slide"
        :style="{ background: slide.bg }"
        :aria-hidden="i === index ? 'false' : 'true'"
        role="group"
        aria-roledescription="slide"
        :aria-label="`第 ${i + 1} 张，共 ${total} 张：${slide.title}`"
      >
        <div class="hero__copy">
          <span class="hero__eyebrow">{{ slide.eyebrow }}</span>
          <h2 class="hero__title">{{ slide.title }}</h2>
          <p class="hero__desc">{{ slide.desc }}</p>
          <RouterLink
            class="btn btn--primary hero__cta"
            :to="slide.to"
          >
            {{ slide.cta }}
            <AppIcon name="arrowRight" :size="16" />
          </RouterLink>
        </div>

        <!-- 内联矢量插画：资料目录 / 讨论网络 / 空间模型 -->
        <div class="hero__art" aria-hidden="true">
          <svg v-if="slide.key === 'materials'" viewBox="0 0 320 220" fill="none">
            <rect x="72" y="38" width="166" height="142" rx="8" fill="var(--bg-card)" opacity="0.55" />
            <rect x="56" y="50" width="166" height="142" rx="8" fill="var(--bg-card)" stroke="var(--color-secondary)" opacity="0.7" />
            <rect x="40" y="62" width="166" height="142" rx="8" fill="var(--bg-card)" stroke="var(--color-primary)" stroke-width="1.5" />
            <path d="M62 86h58M62 101h96M62 116h80" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" opacity="0.55" />
            <path d="M62 148c18-22 37 17 55-6s39 13 60-8" stroke="var(--color-secondary)" stroke-width="1.5" stroke-linecap="round" />
            <ellipse cx="108" cy="148" rx="24" ry="9" stroke="var(--color-secondary)" stroke-width="1" opacity="0.55" />
            <ellipse cx="160" cy="148" rx="18" ry="7" stroke="var(--color-secondary)" stroke-width="1" opacity="0.55" />
            <circle cx="254" cy="58" r="24" fill="var(--color-accent-soft)" stroke="var(--color-accent)" />
            <path d="M254 44v28M240 58h28" stroke="var(--color-accent)" stroke-width="1.5" />
          </svg>

          <svg v-else-if="slide.key === 'forum'" viewBox="0 0 320 220" fill="none">
            <path d="M86 78 158 118M170 118l62-48M170 132l58 42" stroke="var(--color-secondary)" stroke-width="1.5" opacity="0.45" />
            <rect x="24" y="52" width="92" height="54" rx="10" fill="var(--bg-card)" stroke="var(--color-primary)" stroke-width="1.4" />
            <path d="M48 116l9 15v-15" fill="var(--bg-card)" stroke="var(--color-primary)" stroke-width="1.4" />
            <path d="M45 72h49M45 86h34" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" opacity="0.55" />
            <rect x="128" y="98" width="92" height="54" rx="10" fill="var(--bg-card)" stroke="var(--color-accent)" stroke-width="1.5" />
            <path d="M198 152l-7 15 19-15" fill="var(--bg-card)" stroke="var(--color-accent)" stroke-width="1.5" />
            <path d="M150 118h48M150 132h32" stroke="var(--color-accent)" stroke-width="2" stroke-linecap="round" opacity="0.7" />
            <rect x="218" y="34" width="78" height="46" rx="9" fill="var(--bg-card)" stroke="var(--color-secondary)" stroke-width="1.3" />
            <path d="M236 52h42M236 65h28" stroke="var(--color-secondary)" stroke-width="1.8" stroke-linecap="round" opacity="0.6" />
            <circle cx="106" cy="173" r="5" fill="var(--color-primary)" opacity="0.55" />
            <circle cx="126" cy="181" r="4" fill="var(--color-secondary)" opacity="0.45" />
            <circle cx="144" cy="175" r="3" fill="var(--color-accent)" opacity="0.55" />
          </svg>

          <svg v-else viewBox="0 0 320 220" fill="none">
            <g stroke="var(--color-secondary)" stroke-width="1" opacity="0.25">
              <path d="M28 38H292M28 76H292M28 114H292M28 152H292M28 190H292" />
              <path d="M48 24V198M98 24V198M148 24V198M198 24V198M248 24V198M298 24V198" />
            </g>
            <circle cx="148" cy="112" r="58" stroke="var(--color-primary)" stroke-width="1.8" />
            <circle cx="148" cy="112" r="39" stroke="var(--color-primary)" stroke-width="1.2" opacity="0.65" />
            <circle cx="148" cy="112" r="19" stroke="var(--color-primary)" stroke-width="1.2" opacity="0.45" />
            <circle cx="148" cy="112" r="5" fill="var(--color-accent)" />
            <path d="M66 178l42-48 36 24 48-70 62 34" stroke="var(--color-accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
            <g fill="var(--bg-card)" stroke="var(--color-accent)" stroke-width="2">
              <circle cx="108" cy="130" r="6" />
              <circle cx="144" cy="154" r="6" />
              <circle cx="192" cy="84" r="6" />
              <circle cx="254" cy="118" r="6" />
            </g>
            <path d="M222 166v32M208 198h28" stroke="var(--color-secondary)" stroke-width="1.6" />
            <path d="M222 166v-8M214 174h-8M238 174h8M222 190v8" stroke="var(--color-secondary)" stroke-width="1.2" opacity="0.65" />
          </svg>
        </div>
      </article>
    </div>

    <button class="hero__nav hero__nav--prev" type="button" aria-label="上一张" @click="prev">
      <AppIcon name="chevronLeft" :size="18" />
    </button>
    <button class="hero__nav hero__nav--next" type="button" aria-label="下一张" @click="next">
      <AppIcon name="chevronRight" :size="18" />
    </button>

    <div class="hero__dots" role="tablist" aria-label="选择轮播内容">
      <button
        v-for="(slide, i) in SLIDES"
        :key="slide.key"
        class="hero__dot"
        :class="{ 'is-active': i === index }"
        type="button"
        role="tab"
        :aria-selected="i === index"
        :aria-label="slide.title"
        @click="go(i)"
      />
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  margin-bottom: 32px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
  touch-action: pan-y;
}

.hero__track {
  display: flex;
  transition: transform 0.45s var(--ease);
}

.hero__slide {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 320px);
  align-items: center;
  gap: 16px;
  flex: 0 0 100%;
  min-height: 300px;
  padding: 36px 40px;
}

.hero__copy {
  max-width: 520px;
}

.hero__eyebrow {
  display: inline-block;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  background: var(--bg-card);
  color: var(--color-primary);
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
  box-shadow: var(--shadow-card);
}

.hero__title {
  margin: 14px 0 8px;
  font-size: clamp(28px, 2.8vw, 38px);
  font-weight: var(--fw-semibold);
  line-height: 1.25;
  letter-spacing: -0.025em;
  color: var(--text-1);
  text-wrap: balance;
}

.hero__desc {
  margin: 0 0 20px;
  color: var(--text-2);
  line-height: var(--lh-body);
  text-wrap: pretty;
}

.hero__art {
  display: flex;
  justify-content: flex-end;
}

.hero__art svg {
  width: 100%;
  max-width: 320px;
  height: auto;
}

.hero__nav {
  position: absolute;
  top: 50%;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  transform: translateY(-50%);
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--bg-card);
  color: var(--text-2);
  cursor: pointer;
  opacity: 0.75;
  transition: opacity var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
}

.hero__nav:hover {
  opacity: 1;
  color: var(--color-primary);
}

.hero__nav--prev {
  left: 12px;
}

.hero__nav--next {
  right: 12px;
}

.hero__dots {
  position: absolute;
  bottom: 14px;
  left: 50%;
  display: flex;
  gap: 8px;
  transform: translateX(-50%);
}

.hero__dot {
  width: 8px;
  height: 8px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--border-strong);
  cursor: pointer;
  transition: width var(--dur-fast) var(--ease), background-color var(--dur-fast) var(--ease);
}

.hero__dot.is-active {
  width: 22px;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
}

@media (max-width: 900px) {
  .hero__slide {
    grid-template-columns: minmax(0, 1fr);
    padding: 28px 22px 44px;
  }

  .hero__art {
    display: none;
  }
}
</style>

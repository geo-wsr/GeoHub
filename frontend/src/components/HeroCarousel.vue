<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import AppIcon from './AppIcon.vue'

/**
 * 首页主题大图轮播。
 *
 * 插画用内联 SVG 画（不是位图）：任意分辨率都清晰、体积几乎为零，
 * 颜色全部走设计令牌，浅色/深色主题切换时自动适配。
 * 交互：自动播放（6s）+ 左右箭头 + 圆点 + 触摸/鼠标左右滑动；
 * 悬停、页面不可见、系统偏好"减少动效"时都会暂停自动播放。
 */
const SLIDES = [
  {
    key: 'relief',
    eyebrow: '自然地理',
    title: '从等高线读懂山川',
    desc: '地貌、气候、水文、土壤、植被 —— 课件、笔记与真题按主题归类，随取随用。',
    cta: '浏览自然地理资料',
    query: { category: 'physical' },
    bg: 'linear-gradient(135deg, var(--color-primary-soft), var(--bg-card) 62%)',
  },
  {
    key: 'gis',
    eyebrow: 'GIS 与遥感',
    title: '把地球装进一张图',
    desc: '遥感影像、空间分析、专题制图，从软件入门到项目实战的资料与经验都在这里。',
    cta: '看看 GIS 资料',
    query: { category: 'gis' },
    bg: 'linear-gradient(135deg, var(--color-secondary-soft), var(--bg-card) 62%)',
  },
  {
    key: 'human',
    eyebrow: '人文地理',
    title: '人口、城市与经济的地理逻辑',
    desc: '城市群、人口迁移、区域差异，用案例和数据把课本上的结论讲透。',
    cta: '进入人文地理板块',
    query: { category: 'human' },
    bg: 'linear-gradient(135deg, var(--color-accent-soft), var(--bg-card) 62%)',
  },
  {
    key: 'math',
    eyebrow: '数理基础',
    title: '把公式用在地图上',
    desc: '高等数学、线性代数、概率统计、大学物理 —— 地学专业的数理地基，例题与习题解析都在这。',
    cta: '查看数理基础资料',
    query: { category: 'math' },
    bg: 'linear-gradient(135deg, var(--bg-hover), var(--bg-card) 62%)',
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
    aria-label="地理学主题轮播"
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
            :to="{ name: 'materials', query: slide.query }"
          >
            {{ slide.cta }}
            <AppIcon name="arrowRight" :size="16" />
          </RouterLink>
        </div>

        <!-- 内联矢量插画：等高线山体 / 遥感网格 / 城市与人口 / 坐标系与曲线 -->
        <div class="hero__art" aria-hidden="true">
          <svg v-if="slide.key === 'relief'" viewBox="0 0 320 220" fill="none">
            <circle cx="248" cy="54" r="26" fill="var(--color-accent-soft)" />
            <circle
              cx="248"
              cy="54"
              r="26"
              stroke="var(--color-accent)"
              stroke-width="1.4"
              opacity="0.7"
            />
            <path
              d="M0 196 L78 108 L124 152 L176 84 L232 150 L320 96 L320 220 L0 220 Z"
              fill="var(--color-primary)"
              opacity="0.14"
            />
            <path
              d="M0 200 L70 132 L118 170 L170 112 L226 168 L320 118"
              stroke="var(--color-primary)"
              stroke-width="2.2"
              stroke-linejoin="round"
            />
            <g stroke="var(--color-primary)" stroke-width="1.1" opacity="0.45">
              <ellipse cx="176" cy="120" rx="52" ry="18" />
              <ellipse cx="176" cy="120" rx="34" ry="11" />
              <ellipse cx="176" cy="120" rx="16" ry="5" />
              <ellipse cx="78" cy="150" rx="40" ry="13" />
              <ellipse cx="78" cy="150" rx="20" ry="6" />
            </g>
          </svg>

          <svg v-else-if="slide.key === 'gis'" viewBox="0 0 320 220" fill="none">
            <g stroke="var(--color-secondary)" stroke-width="1" opacity="0.35">
              <path d="M32 24 H296 M32 62 H296 M32 100 H296 M32 138 H296 M32 176 H296" />
              <path d="M48 16 V188 M96 16 V188 M144 16 V188 M192 16 V188 M240 16 V188 M288 16 V188" />
            </g>
            <circle
              cx="164"
              cy="104"
              r="52"
              stroke="var(--color-secondary)"
              stroke-width="2"
            />
            <ellipse
              cx="164"
              cy="104"
              rx="52"
              ry="20"
              stroke="var(--color-secondary)"
              stroke-width="1.2"
              opacity="0.6"
            />
            <ellipse
              cx="164"
              cy="104"
              rx="20"
              ry="52"
              stroke="var(--color-secondary)"
              stroke-width="1.2"
              opacity="0.6"
            />
            <ellipse
              cx="164"
              cy="120"
              rx="132"
              ry="46"
              stroke="var(--color-accent)"
              stroke-width="1.2"
              stroke-dasharray="5 6"
              opacity="0.8"
            />
            <circle cx="252" cy="94" r="5" fill="var(--color-accent)" />
            <g fill="var(--color-primary)" opacity="0.5">
              <rect x="86" y="146" width="14" height="14" />
              <rect x="104" y="146" width="14" height="14" opacity="0.7" />
              <rect x="86" y="164" width="14" height="14" opacity="0.45" />
              <rect x="104" y="164" width="14" height="14" opacity="0.3" />
            </g>
          </svg>

          <svg v-else-if="slide.key === 'human'" viewBox="0 0 320 220" fill="none">
            <g fill="var(--color-primary)" opacity="0.18">
              <rect x="36" y="120" width="26" height="76" />
              <rect x="70" y="92" width="30" height="104" />
              <rect x="108" y="132" width="22" height="64" />
              <rect x="138" y="70" width="34" height="126" />
              <rect x="180" y="108" width="26" height="88" />
              <rect x="214" y="86" width="30" height="110" />
              <rect x="252" y="126" width="24" height="70" />
            </g>
            <path
              d="M36 150 L96 118 L150 96 L206 74 L266 52"
              stroke="var(--color-accent)"
              stroke-width="2.2"
              stroke-linecap="round"
            />
            <g fill="var(--color-accent)">
              <circle cx="36" cy="150" r="3.4" />
              <circle cx="96" cy="118" r="3.4" />
              <circle cx="150" cy="96" r="3.4" />
              <circle cx="206" cy="74" r="3.4" />
              <circle cx="266" cy="52" r="3.4" />
            </g>
            <g fill="var(--color-secondary)" opacity="0.55">
              <circle cx="60" cy="176" r="3" />
              <circle cx="92" cy="188" r="3" />
              <circle cx="128" cy="172" r="3" />
              <circle cx="164" cy="186" r="3" />
              <circle cx="200" cy="170" r="3" />
              <circle cx="236" cy="184" r="3" />
            </g>
          </svg>

          <svg v-else viewBox="0 0 320 220" fill="none">
            <g stroke="var(--color-secondary)" stroke-width="1" opacity="0.28">
              <path d="M52 44 H296 M52 76 H296 M52 108 H296 M52 140 H296 M52 172 H296" />
              <path d="M84 28 V192 M116 28 V192 M148 28 V192 M180 28 V192 M212 28 V192 M244 28 V192 M276 28 V192" />
            </g>
            <path d="M52 192 H300" stroke="var(--color-primary)" stroke-width="1.8" />
            <path d="M52 196 V30" stroke="var(--color-primary)" stroke-width="1.8" />
            <path d="M300 192 l-9 -4 v8 z" fill="var(--color-primary)" />
            <path d="M52 30 l-4 9 h8 z" fill="var(--color-primary)" />
            <path
              d="M52 166 C 92 62 128 58 164 116 S 244 178 292 84"
              stroke="var(--color-accent)"
              stroke-width="2.2"
              stroke-linecap="round"
            />
            <path
              d="M52 186 L292 62"
              stroke="var(--color-secondary)"
              stroke-width="1.4"
              stroke-dasharray="6 5"
              opacity="0.75"
            />
            <g fill="var(--color-accent)">
              <circle cx="92" cy="132" r="3.4" />
              <circle cx="140" cy="104" r="3.4" />
              <circle cx="188" cy="120" r="3.4" />
              <circle cx="236" cy="112" r="3.4" />
              <circle cx="276" cy="92" r="3.4" />
            </g>
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
  font-size: var(--fs-h1);
  font-weight: var(--fw-semibold);
  line-height: var(--lh-title);
  color: var(--text-1);
}

.hero__desc {
  margin: 0 0 20px;
  color: var(--text-2);
  line-height: var(--lh-body);
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

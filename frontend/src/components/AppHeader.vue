<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { ADMIN_URL, errorMessage } from '@/api'
import { authState, signOut } from '@/stores/auth'
import { notificationState, refreshUnread } from '@/stores/notification'
import { pushToast } from '@/stores/toast'
import AppIcon from './AppIcon.vue'
import ThemeToggle from './ThemeToggle.vue'
import UserAvatar from './UserAvatar.vue'

const route = useRoute()
const router = useRouter()

const keyword = ref('')
const scrolled = ref(false)
const menuOpen = ref(false)

const isLoggedIn = computed(() => Boolean(authState.user))
const isAdmin = computed(() => Boolean(authState.user?.is_staff))

// 主导航三大入口：首页 / 资料库 / 论坛（细分分类与板块在页面侧边栏切换）
const NAV = [
  { key: 'home', label: '首页', to: { name: 'home' } },
  { key: 'materials', label: '资料库', to: { name: 'materials' } },
  { key: 'forum', label: '论坛', to: { name: 'forum' } },
]

const activeNav = computed(() => {
  const name = route.name
  if (name === 'home') return 'home'
  if (['materials', 'material-detail', 'upload'].includes(name)) return 'materials'
  if (['forum', 'topic-detail', 'topic-new'].includes(name)) return 'forum'
  return ''
})

function handleScroll() {
  scrolled.value = window.scrollY > 4
}

/** 点击空白处收起用户菜单 */
function handleDocumentClick(event) {
  if (!event.target.closest?.('.user-entry')) menuOpen.value = false
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  document.addEventListener('click', handleDocumentClick)
  handleScroll()
  refreshUnread()
})

watch(() => authState.user?.id, refreshUnread)

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  document.removeEventListener('click', handleDocumentClick)
})

function submitSearch() {
  const value = keyword.value.trim()
  router.push({ name: 'search', query: value ? { q: value } : {} })
}

async function handleLogout() {
  menuOpen.value = false
  try {
    await signOut()
    pushToast('已退出登录', 'success')
    router.push({ name: 'home' })
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  }
}
</script>

<template>
  <header class="site-header" :class="{ 'is-scrolled': scrolled }">
    <div class="container site-header__inner">
      <RouterLink to="/" class="brand">
        <span class="brand__logo"><AppIcon name="contour" :size="20" /></span>
        <span class="brand__text">地理资料库</span>
      </RouterLink>

      <nav class="main-nav" aria-label="主导航">
        <RouterLink
          v-for="item in NAV"
          :key="item.key"
          class="main-nav__link"
          :class="{ 'is-active': activeNav === item.key }"
          :to="item.to"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="header-actions">
        <form class="search" role="search" @submit.prevent="submitSearch">
          <AppIcon class="search__icon" name="search" :size="16" />
          <input
            v-model="keyword"
            class="search__input"
            type="search"
            placeholder="搜索资料或帖子"
            aria-label="全局搜索"
          />
        </form>

        <ThemeToggle />

        <RouterLink
          v-if="isLoggedIn"
          class="bell"
          :to="{ name: 'profile', query: { tab: 'notifications' } }"
          aria-label="站内通知"
          title="站内通知"
        >
          <AppIcon name="bell" :size="18" />
          <span v-if="notificationState.unread" class="bell__badge num">
            {{ notificationState.unread > 99 ? '99+' : notificationState.unread }}
          </span>
        </RouterLink>

        <div class="user-entry">
          <button
            v-if="isLoggedIn"
            class="user-entry__trigger"
            type="button"
            :aria-expanded="menuOpen"
            aria-haspopup="menu"
            @click="menuOpen = !menuOpen"
          >
              <UserAvatar
                :name="authState.user.display_name"
                :src="authState.user.avatar_url"
                :size="30"
              />
          </button>
          <RouterLink v-else class="btn btn--secondary btn--sm" :to="{ name: 'login' }">
            登录
          </RouterLink>

          <Transition name="menu">
            <div v-if="menuOpen && isLoggedIn" class="user-menu" role="menu">
              <div class="user-menu__head">
                <strong>{{ authState.user.display_name }}</strong>
                <span class="user-menu__account">
                  @{{ authState.user.username }}
                  <template v-if="isAdmin"> · 管理员</template>
                </span>
              </div>
              <RouterLink
                class="user-menu__item"
                :to="{ name: 'profile' }"
                @click="menuOpen = false"
              >
                <AppIcon name="user" :size="16" />个人中心
              </RouterLink>
              <RouterLink
                class="user-menu__item"
                :to="{ name: 'upload' }"
                @click="menuOpen = false"
              >
                <AppIcon name="upload" :size="16" />
                {{ isAdmin ? '直接上传资料' : '提交上传资料' }}
              </RouterLink>
              <RouterLink
                v-if="isAdmin"
                class="user-menu__item"
                :to="{ name: 'review' }"
                @click="menuOpen = false"
              >
                <AppIcon name="check" :size="16" />资料审核
              </RouterLink>
              <a v-if="isAdmin" class="user-menu__item" :href="ADMIN_URL">
                <AppIcon name="external" :size="16" />Django 后台
              </a>
              <button class="user-menu__item" type="button" @click="handleLogout">
                <AppIcon name="logout" :size="16" />退出登录
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  height: var(--nav-height);
  /* 毛玻璃 + 半透明背景，滚动时再叠加阴影 */
  background: var(--bg-nav);
  backdrop-filter: saturate(180%) blur(12px);
  -webkit-backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid transparent;
  transition: box-shadow var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease),
    background-color var(--dur-theme) var(--ease);
}

.site-header.is-scrolled {
  border-bottom-color: var(--border);
  box-shadow: var(--shadow-nav);
}

.site-header__inner {
  display: flex;
  align-items: center;
  gap: 28px;
  height: 100%;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  color: var(--text-1);
  font-size: var(--fs-h3);
  font-weight: var(--fw-semibold);
}

.brand:hover {
  color: var(--color-primary);
}

.brand__logo {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: #fff;
}

.main-nav {
  display: flex;
  align-items: center;
  gap: 24px;
  flex: 1;
  min-width: 0;
}

.main-nav__link {
  position: relative;
  padding: 4px 0;
  color: var(--text-2);
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
  white-space: nowrap;
}

.main-nav__link::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  height: 2px;
  background: var(--color-primary);
  transform: scaleX(0);
  transition: transform var(--dur-fast) var(--ease);
}

.main-nav__link:hover,
.main-nav__link.is-active {
  color: var(--color-primary);
}

.main-nav__link:hover::after,
.main-nav__link.is-active::after {
  transform: scaleX(1);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
}

.search {
  position: relative;
  display: flex;
  align-items: center;
}

.search__icon {
  position: absolute;
  left: 10px;
  color: var(--text-3);
  pointer-events: none;
}

.search__input {
  width: 200px;
  padding: 7px 12px 7px 32px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--bg-card);
  color: var(--text-1);
  font-family: inherit;
  font-size: var(--fs-small);
  transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease),
    width var(--dur-fast) var(--ease);
}

.search__input:focus {
  outline: none;
  width: 240px;
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
}

.user-entry {
  position: relative;
}

.bell {
  position: relative;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--bg-card);
  color: var(--text-2);
  transition: color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
}

.bell:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.bell__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  padding: 0 4px;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  color: #fff;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}

.user-entry__trigger {
  display: block;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

.user-menu {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  min-width: 200px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  box-shadow: var(--shadow-card-hover);
}

.user-menu__head {
  display: flex;
  flex-direction: column;
  padding: 8px 10px 10px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 6px;
}

.user-menu__account {
  color: var(--text-3);
  font-size: var(--fs-small);
}

.user-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--text-2);
  font-size: var(--fs-body);
  text-align: left;
  cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
}

.user-menu__item:hover {
  background: var(--bg-hover);
  color: var(--color-primary);
  text-decoration: none;
}

.menu-enter-active,
.menu-leave-active {
  transition: opacity var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease);
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 1024px) {
  .site-header__inner {
    gap: 14px;
  }

  .main-nav {
    gap: 16px;
  }

  .search__input {
    width: 130px;
  }
}
</style>

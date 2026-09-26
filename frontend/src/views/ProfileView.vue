<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { api, errorMessage } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import MaterialCard from '@/components/MaterialCard.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import StatusPill from '@/components/StatusPill.vue'
import TopicCard from '@/components/TopicCard.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { applyUser, authState } from '@/stores/auth'
import { refreshUnread } from '@/stores/notification'
import { pushToast } from '@/stores/toast'
import { formatDate, formatSize } from '@/utils/format'

const route = useRoute()
const PAGE_SIZE = 8

// —— 头像 ——
// 前端也拦一道大小/格式，避免把明显不合规的文件传到后端再被打回
const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const avatarInput = ref(null)
const avatarBusy = ref(false)
const avatarProgress = ref(0)

function pickAvatar() {
  avatarInput.value?.click()
}

async function onAvatarChange(event) {
  const file = event.target.files?.[0]
  event.target.value = '' // 允许连续选同一个文件
  if (!file) return
  if (file.size > AVATAR_MAX_BYTES) {
    pushToast('头像不能超过 2 MB', 'error')
    return
  }
  avatarBusy.value = true
  avatarProgress.value = 0
  try {
    const data = await api.uploadAvatar(file, (e) => {
      if (e.total) avatarProgress.value = Math.round((e.loaded / e.total) * 100)
    })
    applyUser(data.user)
    pushToast('头像已更新', 'success')
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  } finally {
    avatarBusy.value = false
  }
}

async function removeAvatar() {
  avatarBusy.value = true
  try {
    const data = await api.removeAvatar()
    applyUser(data.user)
    pushToast('已恢复默认头像', 'success')
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  } finally {
    avatarBusy.value = false
  }
}

// 我的上传 / 收藏 / 帖子 / 回复 / 评论 / 下载记录
const TABS = [
  { key: 'uploads', label: '我的上传', icon: 'upload' },
  { key: 'favorites', label: '我的收藏', icon: 'heart' },
  { key: 'topics', label: '我的帖子', icon: 'comment' },
  { key: 'posts', label: '我的回复', icon: 'reply' },
  { key: 'comments', label: '我的评论', icon: 'comment' },
  { key: 'downloads', label: '下载记录', icon: 'download' },
  { key: 'notifications', label: '站内通知', icon: 'bell' },
]

const stats = ref({
  uploads: 0,
  pending: 0,
  comments: 0,
  favorites: 0,
  downloads: 0,
  topics: 0,
  posts: 0,
  notifications_unread: 0,
})
const activeTab = ref('uploads')
const items = ref([])
const total = ref(0)
const page = ref(1)
const loading = ref(true)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const activeTabMeta = computed(() => TABS.find((tab) => tab.key === activeTab.value))

const STAT_CARDS = computed(() => [
  { key: 'uploads', label: '上传资料', value: stats.value.uploads, icon: 'upload' },
  { key: 'topics', label: '发布帖子', value: stats.value.topics, icon: 'comment' },
  { key: 'favorites', label: '收藏', value: stats.value.favorites, icon: 'heart' },
  { key: 'downloads', label: '下载次数', value: stats.value.downloads, icon: 'download' },
])

async function loadStats() {
  try {
    const data = await api.profile()
    stats.value = data.stats
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  }
}

async function loadList() {
  loading.value = true
  const params = { page: page.value, page_size: PAGE_SIZE }
  try {
    const loaders = {
      uploads: () => api.materials({ mine: 1, ...params }),
      favorites: () => api.favorites(params),
      topics: () => api.myTopics(params),
      posts: () => api.myPosts(params),
      comments: () => api.myComments(params),
      downloads: () => api.downloads(params),
      notifications: () => api.notifications(params),
    }
    const data = await loaders[activeTab.value]()
    items.value = Array.isArray(data) ? data : data.results
    total.value = Array.isArray(data) ? data.length : data.count
  } catch (error) {
    items.value = []
    total.value = 0
    pushToast(errorMessage(error), 'error')
  } finally {
    loading.value = false
  }
}

function switchTab(key) {
  if (activeTab.value === key) return
  activeTab.value = key
  page.value = 1
  loadList()
}

function changePage(next) {
  page.value = next
  loadList()
}

async function markRead(item) {
  try {
    await api.markNotificationRead(item.id)
    item.is_read = true
    stats.value.notifications_unread = Math.max(0, stats.value.notifications_unread - 1)
    await refreshUnread()
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  }
}

async function markAllRead() {
  try {
    await api.markAllNotificationsRead()
    items.value.forEach((row) => {
      row.is_read = true
    })
    stats.value.notifications_unread = 0
    await refreshUnread()
    pushToast('已全部标为已读', 'success')
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  }
}

onMounted(() => {
  // 支持从头部铃铛带 ?tab=notifications 直达
  const tab = route.query.tab
  if (typeof tab === 'string' && TABS.some((item) => item.key === tab)) {
    activeTab.value = tab
  }
  loadStats()
  loadList()
})
</script>

<template>
  <div class="container profile">
    <!-- 用户信息 -->
    <section class="card profile__head">
      <div class="profile__avatar">
        <UserAvatar
          :name="authState.user?.display_name"
          :src="authState.user?.avatar_url"
          :size="56"
        />
        <div class="profile__avatar-actions">
          <button
            class="btn btn--secondary btn--sm"
            type="button"
            :disabled="avatarBusy"
            @click="pickAvatar"
          >
            <AppIcon name="upload" :size="14" />
            {{ avatarBusy ? `上传中 ${avatarProgress}%` : '更换头像' }}
          </button>
          <button
            v-if="authState.user?.avatar_url"
            class="btn btn--text btn--sm"
            type="button"
            :disabled="avatarBusy"
            @click="removeAvatar"
          >
            移除
          </button>
        </div>
        <input
          ref="avatarInput"
          class="profile__avatar-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          @change="onAvatarChange"
        />
      </div>
      <div class="profile__identity">
        <h1 class="profile__name">
          {{ authState.user?.display_name }}
          <span v-if="authState.user?.is_staff" class="pill pill--accent">管理员</span>
        </h1>
        <p class="profile__meta text-small text-muted">
          @{{ authState.user?.username }}
          <template v-if="authState.user?.email"> · {{ authState.user.email }}</template>
          <template v-if="authState.user?.date_joined">
            · 加入于 {{ formatDate(authState.user.date_joined) }}
          </template>
        </p>
      </div>
      <div class="profile__actions">
        <RouterLink class="btn btn--primary btn--sm" :to="{ name: 'upload' }">
          <AppIcon name="upload" :size="16" />
          提交上传资料
        </RouterLink>
        <RouterLink
          v-if="authState.user?.is_staff"
          class="btn btn--secondary btn--sm"
          :to="{ name: 'review' }"
        >
          资料审核
          <span v-if="stats.pending" class="profile__badge num">{{ stats.pending }}</span>
        </RouterLink>
      </div>
    </section>

    <!-- 统计 -->
    <section class="stats">
      <div v-for="item in STAT_CARDS" :key="item.key" class="card stat">
        <span class="stat__icon"><AppIcon :name="item.icon" :size="18" /></span>
        <span class="stat__value num">{{ item.value }}</span>
        <span class="stat__label">{{ item.label }}</span>
      </div>
    </section>

    <!-- 选项卡 -->
    <nav class="tabs" aria-label="个人中心">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        class="tabs__item"
        :class="{ 'is-active': activeTab === tab.key }"
        type="button"
        @click="switchTab(tab.key)"
      >
        <AppIcon :name="tab.icon" :size="16" />
        {{ tab.label }}
      </button>
    </nav>

    <div v-if="loading" class="grid">
      <SkeletonCard v-for="index in 3" :key="index" />
    </div>

    <EmptyState
      v-else-if="!items.length"
      :title="`还没有${activeTabMeta?.label.slice(2)}`"
      description="去资料库或论坛逛逛，产生的内容会出现在这里。"
    >
      <template #action>
        <RouterLink class="btn btn--primary" :to="{ name: 'materials' }">浏览资料库</RouterLink>
      </template>
    </EmptyState>

    <template v-else>
      <!-- 我的上传：卡片 + 审核状态 -->
      <div v-if="activeTab === 'uploads'" class="grid">
        <div v-for="item in items" :key="item.id" class="upload-cell">
          <div class="upload-cell__bar">
            <StatusPill :status="item.status" />
            <span v-if="item.status === 'rejected'" class="upload-cell__note">
              驳回理由：{{ item.review_note || '未填写' }}
            </span>
          </div>
          <MaterialCard :material="item" />
        </div>
      </div>

      <!-- 我的收藏 -->
      <div v-else-if="activeTab === 'favorites'" class="grid">
        <MaterialCard v-for="item in items" :key="item.id" :material="item.material" />
      </div>

      <!-- 我的帖子 -->
      <div v-else-if="activeTab === 'topics'" class="grid">
        <TopicCard v-for="item in items" :key="item.id" :topic="item" />
      </div>

      <!-- 我的回复 -->
      <ul v-else-if="activeTab === 'posts'" class="records">
        <li v-for="item in items" :key="item.id" class="card record">
          <div class="record__main">
            <p class="record__text">{{ item.content }}</p>
            <RouterLink
              class="record__link"
              :to="{ name: 'topic-detail', params: { id: item.topic.id } }"
            >
              <AppIcon name="comment" :size="14" />
              {{ item.topic.title }}
            </RouterLink>
          </div>
          <time class="record__time">{{ formatDate(item.created_at) }}</time>
        </li>
      </ul>

      <!-- 我的评论 -->
      <ul v-else-if="activeTab === 'comments'" class="records">
        <li v-for="item in items" :key="item.id" class="card record">
          <div class="record__main">
            <p class="record__text">{{ item.content }}</p>
            <RouterLink
              class="record__link"
              :to="{ name: 'material-detail', params: { id: item.material.id } }"
            >
              <AppIcon name="comment" :size="14" />
              {{ item.material.title }}
            </RouterLink>
          </div>
          <time class="record__time">{{ formatDate(item.created_at) }}</time>
        </li>
      </ul>

      <!-- 站内通知 -->
      <div v-else-if="activeTab === 'notifications'" class="notice-wrap">
        <div class="notice-tools">
          <span class="text-small text-muted">
            未读 <span class="num">{{ stats.notifications_unread }}</span> 条
          </span>
          <button
            class="btn btn--secondary btn--sm"
            type="button"
            :disabled="!stats.notifications_unread"
            @click="markAllRead"
          >
            全部标为已读
          </button>
        </div>
        <ul class="records">
          <li
            v-for="item in items"
            :key="item.id"
            class="card record"
            :class="{ 'is-unread': !item.is_read }"
          >
            <div class="record__main">
              <p class="record__text">{{ item.text }}</p>
              <div class="record__row">
                <span class="pill pill--ghost">{{ item.kind_display }}</span>
                <RouterLink v-if="item.url" class="record__link" :to="item.url">
                  <AppIcon name="external" :size="14" />
                  查看详情
                </RouterLink>
              </div>
            </div>
            <div class="record__side">
              <time class="record__time">{{ formatDate(item.created_at) }}</time>
              <button
                v-if="!item.is_read"
                class="btn btn--text btn--sm"
                type="button"
                @click="markRead(item)"
              >
                标为已读
              </button>
            </div>
          </li>
        </ul>
      </div>

      <!-- 下载记录 -->
      <ul v-else class="records">
        <li v-for="item in items" :key="item.id" class="card record">
          <div class="record__main">
            <RouterLink
              class="record__title"
              :to="{ name: 'material-detail', params: { id: item.material.id } }"
            >
              {{ item.material.title }}
            </RouterLink>
            <span class="record__meta text-small text-muted">
              {{ item.material.category?.name }} · {{ formatSize(item.material.file_size) }}
            </span>
          </div>
          <time class="record__time">{{ formatDate(item.created_at) }}</time>
        </li>
      </ul>

      <PaginationBar
        :page="page"
        :total-pages="totalPages"
        :total="total"
        @update:page="changePage"
      />
    </template>
  </div>
</template>

<style scoped>
.profile {
  padding-top: 28px;
  padding-bottom: 24px;
}

.profile__head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
}

.profile__avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: none;
}

.profile__avatar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 用隐藏的原生 file input 触发选择，按钮样式统一走设计系统 */
.profile__avatar-input {
  display: none;
}

.profile__identity {
  flex: 1;
  min-width: 0;
}

.profile__name {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.profile__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.profile__badge {
  margin-left: 4px;
  padding: 0 6px;
  border-radius: var(--radius-pill);
  background: var(--status-pending-bg);
  color: var(--status-pending-text);
  font-size: var(--fs-small);
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin: 16px 0 24px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 16px;
}

.stat__icon {
  color: var(--color-secondary);
}

.stat__value {
  color: var(--text-1);
  font-size: 22px;
  font-weight: var(--fw-semibold);
  line-height: 1.3;
}

.stat__label {
  color: var(--text-3);
  font-size: var(--fs-small);
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.tabs__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--text-2);
  font-size: var(--fs-h4);
  font-weight: var(--fw-medium);
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
}

.tabs__item:hover {
  color: var(--color-primary);
}

.tabs__item.is-active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.upload-cell {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upload-cell__bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.upload-cell__note {
  color: var(--status-rejected-text);
  font-size: var(--fs-small);
}

.records {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.notice-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notice-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.record.is-unread {
  /* 未读通知左侧加一条强调色标识 */
  border-left: 3px solid var(--color-accent);
}

.record__row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.record__side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex: none;
}

.record {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
}

.record__main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.record__text {
  color: var(--text-1);
  line-height: var(--lh-body);
  word-break: break-word;
}

.record__link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--fs-small);
  color: var(--color-secondary);
}

.record__title {
  font-size: var(--fs-h3);
  color: var(--text-1);
}

.record__title:hover {
  color: var(--color-primary);
}

.record__time {
  flex: none;
  color: var(--text-3);
  font-size: var(--fs-small);
}

@media (max-width: 1024px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .profile__head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

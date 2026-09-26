<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { api, downloadUrl, errorMessage } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import CommentSection from '@/components/CommentSection.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import StatusPill from '@/components/StatusPill.vue'
import { authState } from '@/stores/auth'
import { pushToast } from '@/stores/toast'
import { categoryIcon, fileLabel, formatDate, formatSize } from '@/utils/format'

const props = defineProps({
  id: { type: [String, Number], required: true },
})

const route = useRoute()
const router = useRouter()

const material = ref(null)
const related = ref([])
const loading = ref(true)
const missing = ref(false)
const favoriting = ref(false)

const infoRows = computed(() => {
  const item = material.value
  if (!item) return []
  return [
    {
      label: item.is_external ? '文件位置' : '文件名',
      value: item.is_external ? '外部链接（不占本站空间）' : item.original_name || '—',
      icon: 'folder',
    },
    { label: '格式', value: fileLabel(item.file_ext), icon: 'tag' },
    {
      label: '大小',
      value: item.is_external ? '见来源站点' : formatSize(item.file_size),
      icon: 'layers',
    },
    { label: '下载量', value: `${item.download_count} 次`, icon: 'download' },
    { label: '收藏数', value: `${item.favorite_count} 人`, icon: 'heart' },
    { label: '上传时间', value: formatDate(item.created_at), icon: 'clock' },
  ]
})

async function load() {
  loading.value = true
  missing.value = false
  try {
    material.value = await api.material(props.id)
    api
      .relatedMaterials(props.id)
      .then((list) => {
        related.value = list
      })
      .catch(() => {
        related.value = []
      })
  } catch (error) {
    if (error?.response?.status === 404) {
      missing.value = true
    } else {
      pushToast(errorMessage(error), 'error')
    }
  } finally {
    loading.value = false
  }
}

/** 下载：交给浏览器原生跳转，后端会累加下载量并留下记录 */
function handleDownload() {
  if (!material.value) return
  // 游客不可下载：引导到登录页并带回跳地址
  if (!authState.user) {
    pushToast('登录后即可下载资料', 'info')
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  window.location.href = downloadUrl(material.value.id)
  // 乐观更新计数，避免要刷新页面才看到变化
  material.value.download_count += 1
  pushToast('开始下载…', 'success')
}

async function toggleFavorite() {
  if (!authState.user) {
    pushToast('登录后即可收藏', 'info')
    router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
    return
  }
  if (favoriting.value) return
  favoriting.value = true
  try {
    const result = await api.toggleFavorite(material.value.id)
    material.value.is_favorited = result.is_favorited
    material.value.favorite_count = result.favorite_count
    pushToast(result.is_favorited ? '已加入收藏' : '已取消收藏', 'success')
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  } finally {
    favoriting.value = false
  }
}

async function removeMaterial() {
  if (!window.confirm('删除后文件将无法恢复，确定删除这份资料吗？')) return
  try {
    await api.deleteMaterial(material.value.id)
    pushToast('资料已删除', 'success')
    router.push({ name: 'materials' })
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  }
}

/** 评论数变化时同步页面上的计数 */
function handleCommentCount(delta) {
  if (material.value) {
    material.value.comment_count = Math.max(0, (material.value.comment_count || 0) + delta)
  }
}

watch(() => props.id, load, { immediate: true })
</script>

<template>
  <div class="container detail">
    <RouterLink class="back" :to="{ name: 'materials' }">
      <AppIcon name="chevronLeft" :size="14" />
      返回资料库
    </RouterLink>

    <div v-if="loading" class="detail__body">
      <div class="detail__main">
        <SkeletonCard />
        <div class="card" style="margin-top: 16px">
          <div class="skeleton" style="width: 100%; height: 90px" />
        </div>
      </div>
      <aside class="detail__side">
        <SkeletonCard />
      </aside>
    </div>

    <div v-else-if="missing" class="card detail__missing">
      <h2>资料不存在或已下架</h2>
      <p class="text-muted">它可能已被上传者删除。你可以回到资料库看看别的。</p>
      <RouterLink class="btn btn--primary" :to="{ name: 'materials' }">返回资料库</RouterLink>
    </div>

    <div v-else-if="material" class="detail__body">
      <!-- 左 7：简介 + 下载 + 评论 -->
      <article class="detail__main">
        <div class="card detail__intro">
          <div class="detail__cat">
            <RouterLink
              class="pill"
              :to="{ name: 'materials', query: { category: material.category?.slug } }"
            >
              <AppIcon :name="categoryIcon(material.category?.slug)" :size="14" />
              {{ material.category?.name }}
            </RouterLink>
            <span v-if="material.download_count >= 5" class="pill pill--accent">热门</span>
          </div>

          <h1 class="detail__title">{{ material.title }}</h1>

          <div class="detail__meta">
            <span class="detail__meta-item">
              <AppIcon name="user" :size="14" />
              {{ material.uploader?.display_name }}
            </span>
            <span class="detail__meta-item">
              <AppIcon name="clock" :size="14" />
              <time>{{ formatDate(material.created_at) }}</time>
            </span>
            <span class="detail__meta-item">
              <AppIcon name="download" :size="14" />
              <span class="num">{{ material.download_count }}</span> 次下载
            </span>
          </div>

          <div v-if="material.tags?.length" class="detail__tags">
            <RouterLink
              v-for="tag in material.tags"
              :key="tag.id"
              class="pill pill--ghost"
              :to="{ name: 'materials', query: { tag: tag.name } }"
            >
              {{ tag.name }}
            </RouterLink>
          </div>

          <div class="divider" />

          <!-- 审核状态提示：本人或管理员可见 -->
          <div
            v-if="
              material.status !== 'approved' && (material.is_owner || authState.user?.is_staff)
            "
            class="review-note"
          >
            <StatusPill :status="material.status" />
            <span v-if="material.status === 'pending'">
              资料已提交，正在等待管理员审核；通过后才会出现在公开资料库。
            </span>
            <span v-else-if="material.status === 'rejected'">
              驳回理由：{{ material.review_note || '未填写' }}
            </span>
          </div>

          <h3 class="detail__subtitle">内容简介</h3>
          <p class="detail__desc">{{ material.description || '上传者没有填写简介。' }}</p>

          <div class="detail__actions">
            <!-- 游客看到登录引导，登录用户才能真正下载 -->
            <button
              v-if="authState.user"
              class="btn btn--primary detail__download"
              type="button"
              @click="handleDownload"
            >
              <AppIcon name="download" :size="18" />
              <template v-if="material.is_external">前往下载</template>
              <template v-else>下载资料（{{ formatSize(material.file_size) }}）</template>
            </button>
            <RouterLink
              v-else
              class="btn btn--primary detail__download"
              :to="{ name: 'login', query: { redirect: route.fullPath } }"
            >
              <AppIcon name="download" :size="18" />
              登录后下载（{{ formatSize(material.file_size) }}）
            </RouterLink>
            <button
              class="btn btn--secondary"
              type="button"
              :disabled="favoriting"
              @click="toggleFavorite"
            >
              <AppIcon :name="material.is_favorited ? 'heartFilled' : 'heart'" :size="16" />
              {{ material.is_favorited ? '已收藏' : '收藏' }}
              <span class="num">{{ material.favorite_count }}</span>
            </button>
            <button
              v-if="material.is_owner && material.status === 'rejected'"
              class="btn btn--secondary"
              type="button"
              @click="router.push({ name: 'upload', query: { edit: material.id } })"
            >
              <AppIcon name="upload" :size="16" />
              修改并重新提交
            </button>
            <button
              v-if="material.is_owner"
              class="btn btn--text btn--danger"
              type="button"
              @click="removeMaterial"
            >
              <AppIcon name="trash" :size="16" />
              删除
            </button>
          </div>
        </div>

        <CommentSection
          :material-id="material.id"
          :initial-count="material.comment_count"
          @count-change="handleCommentCount"
        />
      </article>

      <!-- 右 3：信息卡 + 相关资料 -->
      <aside class="detail__side">
        <div class="card side-block">
          <h3 class="side-block__title">资料信息</h3>
          <ul class="info-list">
            <li v-for="row in infoRows" :key="row.label" class="info-list__row">
              <span class="info-list__label">
                <AppIcon :name="row.icon" :size="14" />
                {{ row.label }}
              </span>
              <span class="info-list__value">{{ row.value }}</span>
            </li>
          </ul>
        </div>

        <div class="card side-block">
          <h3 class="side-block__title">审核记录</h3>
          <ul v-if="material.review_logs?.length" class="log-list">
            <li v-for="log in material.review_logs" :key="log.id" class="log-list__item">
              <div class="log-list__row">
                <span class="log-list__action">{{ log.action_display }}</span>
                <time class="log-list__time">{{ formatDate(log.created_at) }}</time>
              </div>
              <p v-if="log.note" class="log-list__note">{{ log.note }}</p>
            </li>
          </ul>
          <p v-else class="text-small text-muted">暂无记录</p>
        </div>

        <div class="card side-block">
          <h3 class="side-block__title">相关资料</h3>
          <ul v-if="related.length" class="related">
            <li v-for="item in related" :key="item.id">
              <RouterLink
                class="related__item"
                :to="{ name: 'material-detail', params: { id: item.id } }"
              >
                <AppIcon :name="categoryIcon(item.category?.slug)" :size="16" />
                <span class="related__title">{{ item.title }}</span>
              </RouterLink>
            </li>
          </ul>
          <p v-else class="text-small text-muted">暂时没有相关资料</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.detail {
  padding-top: 24px;
  padding-bottom: 24px;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 16px;
  font-size: var(--fs-small);
}

/* 左 7 : 右 3 */
.detail__body {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 3fr);
  gap: 24px;
  align-items: start;
}

.detail__main {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}

.detail__side {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: calc(var(--nav-height) + 24px);
}

.detail__missing {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.detail__cat {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail__cat .pill {
  gap: 5px;
}

.detail__title {
  margin: 12px 0 10px;
}

.detail__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: var(--text-3);
  font-size: var(--fs-small);
}

.detail__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.detail__subtitle {
  margin-bottom: 8px;
}

.review-note {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-hover);
  color: var(--text-2);
  font-size: var(--fs-small);
}

.detail__desc {
  color: var(--text-2);
  line-height: var(--lh-body);
  white-space: pre-wrap;
}

.detail__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
}

.detail__download {
  padding: 10px 20px;
}

.side-block__title {
  margin-bottom: 12px;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.info-list__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  font-size: var(--fs-small);
}

.info-list__label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-3);
  flex: none;
}

.info-list__value {
  color: var(--text-2);
  text-align: right;
  word-break: break-all;
}

.related {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.log-list__item {
  padding-left: 10px;
  border-left: 2px solid var(--border);
}

.log-list__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.log-list__action {
  color: var(--text-2);
  font-size: var(--fs-small);
  font-weight: var(--fw-medium);
}

.log-list__time {
  color: var(--text-3);
  font-size: var(--fs-small);
}

.log-list__note {
  margin-top: 2px;
  color: var(--text-3);
  font-size: var(--fs-small);
  line-height: var(--lh-body);
}

.related__item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  color: var(--text-2);
  font-size: var(--fs-small);
  transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
}

.related__item:hover {
  background: var(--bg-hover);
  color: var(--color-primary);
  text-decoration: none;
}

.related__title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (max-width: 1024px) {
  .detail__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .detail__side {
    position: static;
  }
}
</style>

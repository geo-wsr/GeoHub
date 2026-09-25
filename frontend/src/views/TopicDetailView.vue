<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { api, errorMessage } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import FloorItem from '@/components/FloorItem.vue'
import MarkdownContent from '@/components/MarkdownContent.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { authState } from '@/stores/auth'
import { pushToast } from '@/stores/toast'
import { categoryIcon, formatDate } from '@/utils/format'

const props = defineProps({
  id: { type: [String, Number], required: true },
})

const route = useRoute()
const router = useRouter()

const PAGE_SIZE = 10

const topic = ref(null)
const posts = ref([])
const postTotal = ref(0)
const hotTopics = ref([])
const page = ref(1)
const loading = ref(true)
const missing = ref(false)
const submitting = ref(false)
const content = ref('')
const replyTo = ref(null)

const totalPages = computed(() => Math.max(1, Math.ceil(postTotal.value / PAGE_SIZE)))
const isOwner = computed(() => Boolean(topic.value?.is_owner))
const isAdmin = computed(() => Boolean(authState.user?.is_staff))

async function loadTopic() {
  loading.value = true
  missing.value = false
  try {
    topic.value = await api.topic(props.id)
  } catch (error) {
    if (error?.response?.status === 404) {
      missing.value = true
    } else {
      pushToast(errorMessage(error), 'error')
    }
    loading.value = false
    return
  }
  loading.value = false
  loadPosts()
  api
    .topics({ ordering: 'hot', page_size: 6 })
    .then((data) => {
      hotTopics.value = (Array.isArray(data) ? data : data.results).filter(
        (item) => item.id !== Number(props.id),
      )
    })
    .catch(() => {
      hotTopics.value = []
    })
}

async function loadPosts() {
  try {
    const data = await api.topicPosts(props.id, { page: page.value, page_size: PAGE_SIZE })
    posts.value = Array.isArray(data) ? data : data.results
    postTotal.value = Array.isArray(data) ? data.length : data.count
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  }
}

function requireLogin() {
  if (authState.user) return true
  pushToast('请先登录后再回复', 'info')
  router.push({ name: 'login', query: { redirect: route.fullPath } })
  return false
}

async function submitReply() {
  if (!requireLogin()) return
  const value = content.value.trim()
  if (!value) {
    pushToast('回复内容不能为空', 'info')
    return
  }
  submitting.value = true
  try {
    await api.addTopicPost(props.id, { content: value, parent: replyTo.value?.id ?? null })
    content.value = ''
    replyTo.value = null
    page.value = totalPages.value
    await loadPosts()
    if (topic.value) topic.value.reply_count += 1
    pushToast('回复已发布', 'success')
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  } finally {
    submitting.value = false
  }
}

async function removePost(post) {
  if (!window.confirm('确定删除这条回复吗？')) return
  try {
    await api.deletePost(post.id)
    await loadPosts()
    if (topic.value) topic.value.reply_count = Math.max(0, topic.value.reply_count - 1)
    pushToast('回复已删除', 'success')
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  }
}

async function removeTopic() {
  if (!window.confirm('删除后该主题及其所有回复都会消失，确定删除吗？')) return
  try {
    await api.deleteTopic(props.id)
    pushToast('帖子已删除', 'success')
    router.push({ name: 'forum' })
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  }
}

async function togglePin() {
  try {
    const result = await api.toggleTopicPin(topic.value.id)
    topic.value.is_pinned = result.is_pinned
    pushToast(result.is_pinned ? '已置顶' : '已取消置顶', 'success')
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  }
}

async function toggleFeature() {
  try {
    const result = await api.toggleTopicFeature(topic.value.id)
    topic.value.is_featured = result.is_featured
    pushToast(result.is_featured ? '已设为精华' : '已取消精华', 'success')
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  }
}

function changePage(next) {
  page.value = next
  loadPosts()
}

watch(() => props.id, loadTopic, { immediate: true })
</script>

<template>
  <div class="container topic">
    <RouterLink class="back" :to="{ name: 'forum' }">
      <AppIcon name="chevronLeft" :size="14" />
      返回论坛
    </RouterLink>

    <div v-if="loading" class="topic__body">
      <div class="topic__main">
        <SkeletonCard />
      </div>
      <aside class="topic__side">
        <SkeletonCard />
      </aside>
    </div>

    <div v-else-if="missing" class="card topic__missing">
      <h2>帖子不存在或已被删除</h2>
      <RouterLink class="btn btn--primary" :to="{ name: 'forum' }">返回论坛</RouterLink>
    </div>

    <div v-else-if="topic" class="topic__body">
      <!-- 左 7：正文 + 楼层回复 -->
      <article class="topic__main">
        <div class="card topic__article">
          <div class="topic__top">
            <RouterLink
              class="pill"
              :to="{ name: 'forum', query: { board: topic.board?.slug } }"
            >
              <AppIcon :name="categoryIcon(topic.board?.slug)" :size="14" />
              {{ topic.board?.name }}
            </RouterLink>
            <div class="topic__actions">
              <button
                v-if="isAdmin"
                class="btn btn--text btn--sm"
                type="button"
                @click="togglePin"
              >
                {{ topic.is_pinned ? '取消置顶' : '置顶' }}
              </button>
              <button
                v-if="isAdmin"
                class="btn btn--text btn--sm"
                type="button"
                @click="toggleFeature"
              >
                {{ topic.is_featured ? '取消加精' : '加精' }}
              </button>
              <RouterLink
                v-if="isOwner || isAdmin"
                class="btn btn--text btn--sm"
                :to="{ name: 'topic-new', query: { edit: topic.id } }"
              >
                编辑
              </RouterLink>
              <button
                v-if="isOwner || isAdmin"
                class="btn btn--text btn--sm btn--danger"
                type="button"
                @click="removeTopic"
              >
                删除
              </button>
            </div>
          </div>

          <h1 class="topic__title">
            <span v-if="topic.is_pinned" class="badge badge--pin">置顶</span>
            <span v-if="topic.is_featured" class="badge badge--feature">精华</span>
            {{ topic.title }}
          </h1>

          <div class="topic__meta">
            <UserAvatar :name="topic.author?.display_name" :size="26" />
            <span class="topic__author">{{ topic.author?.display_name }}</span>
            <time>{{ formatDate(topic.created_at) }}</time>
            <span class="topic__stat">
              <AppIcon name="eye" :size="14" />
              <span class="num">{{ topic.views }}</span> 浏览
            </span>
            <span class="topic__stat">
              <AppIcon name="comment" :size="14" />
              <span class="num">{{ topic.reply_count }}</span> 回复
            </span>
          </div>

          <div v-if="topic.tags?.length" class="topic__tags">
            <RouterLink
              v-for="tag in topic.tags"
              :key="tag.id"
              class="pill pill--ghost"
              :to="{ name: 'forum', query: { tag: tag.name } }"
            >
              {{ tag.name }}
            </RouterLink>
          </div>

          <div class="divider" />
          <!-- 正文按 Markdown 渲染（已禁用原始 HTML 并做白名单清洗） -->
          <MarkdownContent class="topic__content" :source="topic.content" />
        </div>

        <!-- 楼层区：按时间正序 -->
        <section class="floors card">
          <div class="floors__head">
            <h2>全部回复</h2>
            <span class="floors__count num">{{ postTotal }}</span>
          </div>

          <EmptyState
            v-if="!posts.length"
            title="还没有人回复"
            description="第一个回复的人，往往能带出整场讨论。"
          />

          <template v-else>
            <FloorItem
              v-for="post in posts"
              :key="post.id"
              :post="post"
              @reply="(target) => (replyTo = target)"
              @remove="removePost"
            />
            <PaginationBar
              :page="page"
              :total-pages="totalPages"
              :total="postTotal"
              @update:page="changePage"
            />
          </template>
        </section>

        <!-- 底部固定回复框 -->
        <div class="composer card">
          <div v-if="replyTo" class="composer__reply">
            <AppIcon name="reply" :size="14" />
            <span>正在回复 <strong>@{{ replyTo.author?.display_name }}</strong></span>
            <button class="btn btn--text btn--sm" type="button" @click="replyTo = null">取消</button>
          </div>
          <MarkdownEditor
            v-model="content"
            class="composer__input"
            :maxlength="1000"
            :rows="4"
            :placeholder="
              authState.user ? '写下你的回复，支持 Markdown，1000 字以内…' : '登录后即可参与讨论'
            "
          />
          <div class="composer__foot">
            <span class="composer__counter num">{{ content.length }}/1000</span>
            <button class="btn btn--primary" type="button" :disabled="submitting" @click="submitReply">
              {{ submitting ? '发布中…' : replyTo ? '回复' : '发表回复' }}
            </button>
          </div>
        </div>
      </article>

      <!-- 右 3：作者信息 + 热门帖子 -->
      <aside class="topic__side">
        <div class="card side-block">
          <h3 class="side-block__title">作者</h3>
          <div class="author">
            <UserAvatar :name="topic.author?.display_name" :size="44" />
            <div>
              <p class="author__name">{{ topic.author?.display_name }}</p>
              <p class="author__account text-small text-muted">@{{ topic.author?.username }}</p>
            </div>
          </div>
          <div class="divider" />
          <p class="text-small text-muted">发布于 {{ formatDate(topic.created_at) }}</p>
        </div>

        <div class="card side-block">
          <h3 class="side-block__title">热门帖子</h3>
          <ul v-if="hotTopics.length" class="hot-list">
            <li v-for="item in hotTopics" :key="item.id">
              <RouterLink
                class="hot-list__item"
                :to="{ name: 'topic-detail', params: { id: item.id } }"
              >
                <AppIcon :name="categoryIcon(item.board?.slug)" :size="16" />
                <span class="hot-list__title">{{ item.title }}</span>
                <span class="hot-list__count num">{{ item.reply_count }}</span>
              </RouterLink>
            </li>
          </ul>
          <p v-else class="text-small text-muted">暂无其他帖子</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.topic {
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
.topic__body {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 3fr);
  gap: 24px;
  align-items: start;
}

.topic__main {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.topic__side {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: calc(var(--nav-height) + 24px);
}

.topic__missing {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.topic__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.topic__top .pill {
  gap: 5px;
}

.topic__actions {
  display: flex;
  gap: 4px;
}

.topic__title {
  margin: 12px 0 10px;
}

.topic__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  color: var(--text-3);
  font-size: var(--fs-small);
}

.topic__author {
  color: var(--text-2);
  font-weight: var(--fw-medium);
}

.topic__stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.topic__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.topic__content {
  /* 具体排版由 .md-body 负责，这里不再使用 pre-wrap（否则会与块级元素叠加出多余空行） */
  margin-top: 4px;
}

.floors {
  padding: 20px;
}

.floors__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.floors__count {
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--bg-hover);
  color: var(--text-3);
  font-size: var(--fs-small);
}

/* 底部固定回复框：随页面滚动停在左列底部 */
.composer {
  position: sticky;
  bottom: 16px;
  box-shadow: var(--shadow-card-hover);
}

.composer__reply {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-hover);
  color: var(--text-2);
  font-size: var(--fs-small);
}

.composer__reply .btn {
  margin-left: auto;
}

.composer__input {
  min-height: 84px;
}

.composer__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}

.composer__counter {
  color: var(--text-3);
  font-size: var(--fs-small);
}

.side-block__title {
  margin-bottom: 12px;
}

.author {
  display: flex;
  align-items: center;
  gap: 12px;
}

.author__name {
  color: var(--text-1);
  font-weight: var(--fw-medium);
}

.hot-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hot-list__item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  color: var(--text-2);
  font-size: var(--fs-small);
  transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
}

.hot-list__item:hover {
  background: var(--bg-hover);
  color: var(--color-primary);
  text-decoration: none;
}

.hot-list__title {
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hot-list__count {
  color: var(--text-3);
}

@media (max-width: 1024px) {
  .topic__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .topic__side {
    position: static;
  }
}
</style>

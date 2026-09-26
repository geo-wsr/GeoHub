<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { api, errorMessage } from '@/api'
import { authState } from '@/stores/auth'
import { pushToast } from '@/stores/toast'
import { formatDate } from '@/utils/format'
import AppIcon from './AppIcon.vue'
import EmptyState from './EmptyState.vue'
import MarkdownContent from './MarkdownContent.vue'
import MarkdownEditor from './MarkdownEditor.vue'
import PaginationBar from './PaginationBar.vue'
import UserAvatar from './UserAvatar.vue'

const props = defineProps({
  materialId: { type: [Number, String], required: true },
  initialCount: { type: Number, default: 0 },
})

const emit = defineEmits(['count-change'])

const router = useRouter()
const PAGE_SIZE = 10

const comments = ref([])
const total = ref(props.initialCount)
const page = ref(1)
const loading = ref(true)
const submitting = ref(false)
const content = ref('')
/** 正在回复的一级评论；为空表示发表新评论 */
const replyTo = ref(null)
// 正在编辑的评论 id 与草稿
const editingId = ref(null)
const editingText = ref('')
const savingEdit = ref(false)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

async function load() {
  loading.value = true
  try {
    const data = await api.comments(props.materialId, {
      page: page.value,
      page_size: PAGE_SIZE,
    })
    comments.value = Array.isArray(data) ? data : data.results
    total.value = Array.isArray(data) ? data.length : data.count
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  } finally {
    loading.value = false
  }
}

function requireLogin() {
  if (authState.user) return true
  pushToast('请先登录后再参与讨论', 'info')
  router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
  return false
}

async function submit() {
  if (!requireLogin()) return
  const value = content.value.trim()
  if (!value) {
    pushToast('评论内容不能为空', 'info')
    return
  }

  submitting.value = true
  try {
    await api.addComment(props.materialId, {
      content: value,
      parent: replyTo.value?.id ?? null,
    })
    content.value = ''
    replyTo.value = null
    page.value = 1
    await load()
    emit('count-change', 1)
    pushToast('评论已发布', 'success')
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  } finally {
    submitting.value = false
  }
}

async function remove(comment) {
  if (!window.confirm('确定删除这条评论吗？')) return
  try {
    await api.deleteComment(comment.id)
    const removed = 1 + (comment.replies?.length || 0)
    await load()
    emit('count-change', -removed)
    pushToast('评论已删除', 'success')
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  }
}

function startEdit(comment) {
  editingId.value = comment.id
  editingText.value = comment.content
}

function cancelEdit() {
  editingId.value = null
  editingText.value = ''
}

async function saveEdit(comment) {
  const value = editingText.value.trim()
  if (!value) {
    pushToast('评论内容不能为空', 'info')
    return
  }
  savingEdit.value = true
  try {
    const updated = await api.updateComment(comment.id, { content: value })
    comment.content = updated.content
    comment.edited_at = updated.edited_at
    cancelEdit()
    pushToast('评论已更新', 'success')
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  } finally {
    savingEdit.value = false
  }
}

onMounted(load)

defineExpose({ load })
</script>

<template>
  <section class="comments">
    <div class="comments__head">
      <h2>评论</h2>
      <span class="comments__count num">{{ total }}</span>
    </div>

    <!-- 输入区：固定高度，发布按钮置于右下角 -->
    <div class="composer card">
      <div v-if="replyTo" class="composer__reply">
        <AppIcon name="reply" :size="14" />
        <span>正在回复 <strong>@{{ replyTo.author.display_name }}</strong></span>
        <button class="btn btn--text btn--sm" type="button" @click="replyTo = null">取消</button>
      </div>
      <MarkdownEditor
        v-model="content"
        :maxlength="1000"
        :rows="4"
        :placeholder="
          authState.user ? '写下你的看法，支持 Markdown，1000 字以内…' : '登录后即可参与讨论'
        "
      />
      <div class="composer__foot">
        <span class="composer__counter num">{{ content.length }}/1000</span>
        <button class="btn btn--primary" type="button" :disabled="submitting" @click="submit">
          {{ submitting ? '发布中…' : replyTo ? '回复' : '发布' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="comments__list">
      <div v-for="index in 3" :key="index" class="comment comment--skeleton">
        <div class="skeleton comment__avatar-skeleton" />
        <div class="comment__body">
          <div class="skeleton" style="width: 140px; height: 12px" />
          <div class="skeleton" style="width: 100%; height: 12px" />
          <div class="skeleton" style="width: 68%; height: 12px" />
        </div>
      </div>
    </div>

    <EmptyState
      v-else-if="!comments.length"
      title="还没有评论"
      description="来发表第一条看法，帮同学把重点讲清楚。"
    />

    <ul v-else class="comments__list">
      <li v-for="item in comments" :key="item.id" class="comment">
        <UserAvatar
          :name="item.author.display_name"
          :src="item.author.avatar_url"
          :size="32"
        />
        <div class="comment__body">
          <div class="comment__meta">
            <span class="comment__author">{{ item.author.display_name }}</span>
            <time class="comment__time">{{ formatDate(item.created_at) }}</time>
          </div>
          <div v-if="editingId === item.id" class="composer__edit">
            <textarea v-model="editingText" class="textarea" maxlength="1000" />
            <div class="composer__edit-actions">
              <button class="btn btn--text btn--sm" type="button" @click="cancelEdit">取消</button>
              <button
                class="btn btn--primary btn--sm"
                type="button"
                :disabled="savingEdit"
                @click="saveEdit(item)"
              >
                保存
              </button>
            </div>
          </div>
          <MarkdownContent v-else class="comment__content" :source="item.content" />
          <span v-if="item.edited_at && editingId !== item.id" class="comment__edited">
            已编辑
          </span>
          <div class="comment__actions">
            <button class="btn btn--text btn--sm" type="button" @click="replyTo = item">
              回复
            </button>
            <button
              v-if="item.is_owner"
              class="btn btn--text btn--sm"
              type="button"
              @click="startEdit(item)"
            >
              编辑
            </button>
            <button
              v-if="item.is_owner"
              class="btn btn--text btn--sm btn--danger"
              type="button"
              @click="remove(item)"
            >
              删除
            </button>
          </div>

          <!-- 二级回复：缩进 24px，字号小一号，底色比卡片浅一层 -->
          <ul v-if="item.replies?.length" class="replies">
            <li v-for="reply in item.replies" :key="reply.id" class="reply">
              <UserAvatar
                :name="reply.author.display_name"
                :src="reply.author.avatar_url"
                :size="26"
              />
              <div class="reply__body">
                <div class="comment__meta">
                  <span class="comment__author">{{ reply.author.display_name }}</span>
                  <time class="comment__time">{{ formatDate(reply.created_at) }}</time>
                </div>
                <div v-if="editingId === reply.id" class="composer__edit">
                  <textarea v-model="editingText" class="textarea" maxlength="1000" />
                  <div class="composer__edit-actions">
                    <button class="btn btn--text btn--sm" type="button" @click="cancelEdit">
                      取消
                    </button>
                    <button
                      class="btn btn--primary btn--sm"
                      type="button"
                      :disabled="savingEdit"
                      @click="saveEdit(reply)"
                    >
                      保存
                    </button>
                  </div>
                </div>
                <MarkdownContent v-else class="comment__content" :source="reply.content" />
                <span v-if="reply.edited_at && editingId !== reply.id" class="comment__edited">
                  已编辑
                </span>
                <div class="comment__actions">
                  <!-- 回复"回复"时仍然挂到所属的一级评论，保持两级结构 -->
                  <button class="btn btn--text btn--sm" type="button" @click="replyTo = item">
                    回复
                  </button>
                  <button
                    v-if="reply.is_owner"
                    class="btn btn--text btn--sm"
                    type="button"
                    @click="startEdit(reply)"
                  >
                    编辑
                  </button>
                  <button
                    v-if="reply.is_owner"
                    class="btn btn--text btn--sm btn--danger"
                    type="button"
                    @click="remove(reply)"
                  >
                    删除
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </li>
    </ul>

    <PaginationBar
      :page="page"
      :total-pages="totalPages"
      :total="total"
      @update:page="
        (next) => {
          page = next
          load()
        }
      "
    />
  </section>
</template>

<style scoped>
.comments__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.comments__count {
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--bg-hover);
  color: var(--text-3);
  font-size: var(--fs-small);
}

.composer {
  margin-bottom: 24px;
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
  min-height: 88px;
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

.comments__list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.comment {
  display: flex;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.comment:last-child {
  border-bottom: 0;
}

.comment--skeleton .comment__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.comment__avatar-skeleton {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex: none;
}

.comment__body {
  flex: 1;
  min-width: 0;
}

.comment__meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.comment__author {
  color: var(--text-2);
  font-size: var(--fs-h4);
  font-weight: var(--fw-medium);
}

.comment__time {
  color: var(--text-3);
  font-size: var(--fs-small);
}

.comment__content {
  /* 排版交给 .md-body；这里只保留与元信息的间距 */
  margin-top: 2px;
}

.comment__actions {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}

.composer__edit {
  margin-top: 6px;
}

.composer__edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}

.comment__edited {
  /* 渲染后的正文是块级元素，"已编辑"标记另起一行紧跟其后 */
  display: inline-block;
  margin-top: 2px;
  color: var(--text-3);
  font-size: var(--fs-small);
}

.replies {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 12px 0 0 24px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  /* 比卡片浅一层的背景 */
  background: var(--bg-hover);
  list-style: none;
}

.reply {
  display: flex;
  gap: 10px;
}

.reply__body {
  flex: 1;
  min-width: 0;
}

.reply .comment__author,
.reply .comment__content,
.reply .comment__time {
  font-size: var(--fs-small);
}

@media (max-width: 640px) {
  .replies {
    margin-left: 12px;
  }
}
</style>

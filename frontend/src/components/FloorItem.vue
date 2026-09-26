<script setup>
import { ref } from 'vue'

import { api, errorMessage } from '@/api'
import { pushToast } from '@/stores/toast'
import { formatDate } from '@/utils/format'
import AppIcon from './AppIcon.vue'
import MarkdownContent from './MarkdownContent.vue'
import UserAvatar from './UserAvatar.vue'

// 论坛楼层：左侧头像 + 楼层号，右侧主体内容。
// 二级回复整体缩进，并以竖线引导，背景比主楼浅一层。
defineProps({
  post: { type: Object, required: true },
})

const emit = defineEmits(['reply', 'remove'])

// 行内编辑：作者或管理员可以修改自己的回复
const editingId = ref(null)
const editingText = ref('')
const saving = ref(false)

function startEdit(item) {
  editingId.value = item.id
  editingText.value = item.content
}

function cancelEdit() {
  editingId.value = null
  editingText.value = ''
}

async function saveEdit(item) {
  const value = editingText.value.trim()
  if (!value) {
    pushToast('回复内容不能为空', 'info')
    return
  }
  saving.value = true
  try {
    const updated = await api.updatePost(item.id, { content: value })
    item.content = updated.content
    item.edited_at = updated.edited_at
    cancelEdit()
    pushToast('回复已更新', 'success')
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <article class="floor">
    <div class="floor__side">
        <UserAvatar
          :name="post.author?.display_name"
          :src="post.author?.avatar_url"
          :size="32"
        />
      <span v-if="post.floor" class="floor__no num">{{ post.floor }} 楼</span>
    </div>

    <div class="floor__body">
      <div class="floor__meta">
        <span class="floor__author">{{ post.author?.display_name }}</span>
        <time class="floor__time">{{ formatDate(post.created_at) }}</time>
      </div>

      <div v-if="editingId === post.id" class="floor__edit">
        <textarea v-model="editingText" class="textarea" maxlength="1000" />
        <div class="floor__edit-actions">
          <button class="btn btn--text btn--sm" type="button" @click="cancelEdit">取消</button>
          <button
            class="btn btn--primary btn--sm"
            type="button"
            :disabled="saving"
            @click="saveEdit(post)"
          >
            保存
          </button>
        </div>
      </div>
      <MarkdownContent v-else class="floor__text" :source="post.content" />
      <span v-if="post.edited_at && editingId !== post.id" class="floor__edited">已编辑</span>

      <div class="floor__actions">
        <button class="btn btn--text btn--sm" type="button" @click="emit('reply', post)">
          回复
        </button>
        <button
          v-if="post.is_owner"
          class="btn btn--text btn--sm"
          type="button"
          @click="startEdit(post)"
        >
          编辑
        </button>
        <button
          v-if="post.is_owner"
          class="btn btn--text btn--sm btn--danger"
          type="button"
          @click="emit('remove', post)"
        >
          删除
        </button>
      </div>

      <!-- 二级回复 -->
      <ul v-if="post.replies?.length" class="subfloors">
        <li v-for="reply in post.replies" :key="reply.id" class="subfloor">
            <UserAvatar
              :name="reply.author?.display_name"
              :src="reply.author?.avatar_url"
              :size="26"
            />
          <div class="subfloor__body">
            <div class="floor__meta">
              <span class="floor__author">{{ reply.author?.display_name }}</span>
              <time class="floor__time">{{ formatDate(reply.created_at) }}</time>
            </div>
            <div v-if="editingId === reply.id" class="floor__edit">
              <textarea v-model="editingText" class="textarea" maxlength="1000" />
              <div class="floor__edit-actions">
                <button class="btn btn--text btn--sm" type="button" @click="cancelEdit">
                  取消
                </button>
                <button
                  class="btn btn--primary btn--sm"
                  type="button"
                  :disabled="saving"
                  @click="saveEdit(reply)"
                >
                  保存
                </button>
              </div>
            </div>
            <MarkdownContent v-else class="floor__text" :source="reply.content" />
            <span v-if="reply.edited_at && editingId !== reply.id" class="floor__edited">
              已编辑
            </span>
            <div class="floor__actions">
              <!-- 回复二级回复时仍然挂到本楼层下，保持两级结构 -->
              <button class="btn btn--text btn--sm" type="button" @click="emit('reply', post)">
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
                @click="emit('remove', reply)"
              >
                删除
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </article>
</template>

<style scoped>
.floor {
  display: flex;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}

.floor:last-child {
  border-bottom: 0;
}

.floor__side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: none;
}

.floor__no {
  color: var(--text-3);
  font-size: var(--fs-small);
  white-space: nowrap;
}

.floor__body {
  flex: 1;
  min-width: 0;
}

.floor__meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.floor__author {
  color: var(--text-2);
  font-size: var(--fs-h4);
  font-weight: var(--fw-medium);
}

.floor__time {
  color: var(--text-3);
  font-size: var(--fs-small);
}

.floor__text {
  /* 排版交给 .md-body；这里只保留与头像/元信息的间距 */
  margin-top: 4px;
}

.floor__actions {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}

.floor__edit {
  margin-top: 6px;
}

.floor__edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}

.floor__edited {
  /* 渲染后的正文是块级元素，"已编辑"标记另起一行紧跟其后 */
  display: inline-block;
  margin-top: 2px;
  color: var(--text-3);
  font-size: var(--fs-small);
}

/* 二级回复：缩进 + 竖线引导 + 浅一层底色 */
.subfloors {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 12px 0 0;
  padding: 12px 14px 12px 16px;
  border-left: 2px solid var(--border-strong);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  background: var(--bg-hover);
  list-style: none;
}

.subfloor {
  display: flex;
  gap: 10px;
}

.subfloor__body {
  flex: 1;
  min-width: 0;
}

.subfloor .floor__author,
.subfloor .floor__text,
.subfloor .floor__time {
  font-size: var(--fs-small);
}
</style>

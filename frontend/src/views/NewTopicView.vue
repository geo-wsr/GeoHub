<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { api, errorMessage } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import { pushToast } from '@/stores/toast'

const route = useRoute()
const router = useRouter()

const boards = ref([])
const errors = ref({})
const submitting = ref(false)

const form = reactive({
  board: '',
  title: '',
  content: '',
  tags: '',
})

// 带 ?edit=<id> 时进入编辑模式，复用同一套表单
const editId = computed(() => (route.query.edit ? Number(route.query.edit) : null))
const isEditing = computed(() => Boolean(editId.value))
const contentLength = computed(() => form.content.length)

function validate() {
  const next = {}
  if (!form.board) next.board = '请选择板块'
  if (form.title.trim().length < 4) next.title = '标题至少 4 个字符'
  if (form.content.trim().length < 10) next.content = '正文至少 10 个字符，请把问题描述清楚'
  errors.value = next
  return Object.keys(next).length === 0
}

async function submit() {
  if (!validate()) return
  submitting.value = true

  const payload = {
    board: Number(form.board),
    title: form.title.trim(),
    content: form.content.trim(),
    tags: form.tags
      .split(/[,，\s]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  }

  try {
    if (isEditing.value) {
      const updated = await api.updateTopic(editId.value, payload)
      pushToast('帖子已更新', 'success')
      router.push({ name: 'topic-detail', params: { id: updated.id } })
    } else {
      const created = await api.createTopic(payload)
      pushToast('发布成功', 'success')
      // 发布后即时进入对应板块列表
      router.push({ name: 'topic-detail', params: { id: created.id } })
    }
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    boards.value = await api.boards()
  } catch {
    boards.value = []
  }

  if (isEditing.value) {
    try {
      const topic = await api.topic(editId.value)
      if (!topic.is_owner) {
        pushToast('只能编辑自己发布的帖子', 'error')
        router.replace({ name: 'topic-detail', params: { id: editId.value } })
        return
      }
      form.board = String(topic.board?.id || '')
      form.title = topic.title
      form.content = topic.content
      form.tags = (topic.tags || []).map((item) => item.name).join(', ')
    } catch (error) {
      pushToast(errorMessage(error), 'error')
      router.replace({ name: 'forum' })
    }
    return
  }

  const preselect = route.query.board
  const matched = boards.value.find((item) => item.slug === preselect)
  form.board = matched ? String(matched.id) : String(boards.value[0]?.id || '')
})
</script>

<template>
  <div class="container topic-new">
    <RouterLink class="back" :to="{ name: 'forum' }">
      <AppIcon name="chevronLeft" :size="14" />
      返回论坛
    </RouterLink>

    <header class="topic-new__head">
      <h1>{{ isEditing ? '编辑帖子' : '发布新帖' }}</h1>
      <p class="text-small text-muted">
        正文支持 Markdown（粗体、列表、引用、代码、链接、表格），发布后作者可自行删除。
      </p>
    </header>

    <form class="card topic-new__form" @submit.prevent="submit">
      <label class="field">
        <span class="field__label">所属板块<span class="field__required">*</span></span>
        <select v-model="form.board" class="select">
          <option value="" disabled>请选择板块</option>
          <option v-for="item in boards" :key="item.id" :value="String(item.id)">
            {{ item.name }}
          </option>
        </select>
        <span v-if="errors.board" class="field__error">{{ errors.board }}</span>
      </label>

      <label class="field">
        <span class="field__label">标题<span class="field__required">*</span></span>
        <input
          v-model="form.title"
          class="input"
          type="text"
          maxlength="200"
          placeholder="一句话说清你的问题或分享主题"
        />
        <span v-if="errors.title" class="field__error">{{ errors.title }}</span>
      </label>

      <!-- 用 div 而非 label：编辑器内部含按钮，交互控件不应包在 <label> 里，
           否则工具栏按钮的可访问名称会被 label 文本污染 -->
      <div class="field">
        <span class="field__label">正文<span class="field__required">*</span></span>
        <MarkdownEditor
          v-model="form.content"
          class="topic-new__content"
          :maxlength="5000"
          :rows="12"
          placeholder="把背景、你已经尝试过的做法和具体疑问写清楚，更容易得到有效回复。支持 Markdown 语法。"
        />
        <span v-if="errors.content" class="field__error">{{ errors.content }}</span>
      </div>

      <label class="field">
        <span class="field__label">标签</span>
        <input
          v-model="form.tags"
          class="input"
          type="text"
          placeholder="用逗号分隔，例如：空间分析, 复习"
        />
        <span class="field__hint">标签会与资料库共用，方便全局搜索聚合。</span>
      </label>

      <!-- 底部：字数统计 + 发布按钮 -->
      <div class="topic-new__foot">
        <span class="topic-new__counter num">{{ contentLength }}/5000</span>
        <div class="topic-new__actions">
          <RouterLink class="btn btn--text" :to="{ name: 'forum' }">取消</RouterLink>
          <button class="btn btn--primary" type="submit" :disabled="submitting">
            {{ submitting ? '提交中…' : isEditing ? '保存修改' : '发布' }}
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
.topic-new {
  padding-top: 24px;
  padding-bottom: 24px;
  max-width: 820px;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 16px;
  font-size: var(--fs-small);
}

.topic-new__head {
  margin-bottom: 20px;
}

.topic-new__head p {
  margin-top: 6px;
}

.topic-new__form {
  padding: 24px;
}

.topic-new__content {
  min-height: 220px;
}

.topic-new__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 8px;
}

.topic-new__counter {
  color: var(--text-3);
  font-size: var(--fs-small);
}

.topic-new__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>

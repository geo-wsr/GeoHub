<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { api, errorMessage } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import { authState } from '@/stores/auth'
import { pushToast } from '@/stores/toast'
import { formatSize } from '@/utils/format'

// 与后端 settings.py 的 MATERIAL_ALLOWED_EXTENSIONS / MATERIAL_MAX_UPLOAD_SIZE 保持一致
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.md', '.zip']
const MAX_SIZE = 50 * 1024 * 1024

const router = useRouter()
const route = useRoute()

// 管理员直传即时发布，普通用户提交后进入审核队列
const isAdmin = computed(() => Boolean(authState.user?.is_staff))

// 带 ?edit=<id> 进入：作者修改被驳回的资料后重新提交
const editId = computed(() => (route.query.edit ? Number(route.query.edit) : null))
const isEditing = computed(() => Boolean(editId.value))

const categories = ref([])
const categoriesError = ref('')
const form = ref({ title: '', category: '', description: '', tags: '' })
const file = ref(null)
const dragging = ref(false)
const errors = ref({})
const submitting = ref(false)
const progress = ref(0)
const fileInput = ref(null)

const acceptAttr = computed(() => ALLOWED_EXTENSIONS.join(','))
const maxSizeLabel = computed(() => formatSize(MAX_SIZE))

function pickFile(candidate) {
  errors.value = { ...errors.value, file: '' }
  if (!candidate) return
  const dotIndex = candidate.name.lastIndexOf('.')
  const ext = dotIndex >= 0 ? candidate.name.slice(dotIndex).toLowerCase() : ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    errors.value = { ...errors.value, file: `不支持的文件格式，仅接受 ${ALLOWED_EXTENSIONS.join(' / ')}` }
    return
  }
  if (candidate.size > MAX_SIZE) {
    errors.value = { ...errors.value, file: `文件不能超过 ${maxSizeLabel.value}` }
    return
  }
  file.value = candidate
}

function handleInputChange(event) {
  pickFile(event.target.files?.[0])
  // 允许再次选择同一个文件
  event.target.value = ''
}

function handleDrop(event) {
  dragging.value = false
  pickFile(event.dataTransfer?.files?.[0])
}

function validate() {
  const next = {}
  if (form.value.title.trim().length < 2) next.title = '标题至少 2 个字符'
  if (!form.value.category) next.category = '请选择所属分类'
  if (!file.value && !isEditing.value) next.file = '请选择要上传的文件'
  errors.value = next
  return Object.keys(next).length === 0
}

async function submit() {
  if (!validate()) return
  submitting.value = true
  progress.value = 0

  const payload = new FormData()
  payload.append('title', form.value.title.trim())
  payload.append('category', form.value.category)
  payload.append('description', form.value.description.trim())
  payload.append('is_public', 'true')
  form.value.tags
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((tag) => payload.append('tags', tag))
  payload.append('file', file.value)

  const onProgress = (event) => {
    if (event.total) progress.value = Math.round((event.loaded / event.total) * 100)
  }

  try {
    const saved = isEditing.value
      ? await api.updateMaterial(editId.value, payload, onProgress)
      : await api.createMaterial(payload, onProgress)
    pushToast(isEditing.value ? '已重新提交，等待审核' : '上传成功', 'success')
    router.push({ name: 'material-detail', params: { id: saved.id } })
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  } finally {
    submitting.value = false
    progress.value = 0
  }
}

/**
 * 分类是进页面时现取的。冷启动/断网导致取不到时必须有明确提示，
 * 否则用户只看到一个空下拉框，会以为功能坏了（线上就这么踩过一次）。
 */
async function loadCategories() {
  categoriesError.value = ''
  try {
    categories.value = await api.categories()
    if (categories.value.length) {
      form.value.category = String(categories.value[0].id)
    } else {
      categoriesError.value = '后端还没返回分类数据。'
    }
  } catch (error) {
    categories.value = []
    categoriesError.value = errorMessage(error)
  }
}

onMounted(async () => {
  await loadCategories()

  if (!editId.value) return
  try {
    const material = await api.material(editId.value)
    if (!material.is_owner) {
      pushToast('只能修改自己提交的资料', 'error')
      router.replace({ name: 'material-detail', params: { id: editId.value } })
      return
    }
    form.value.title = material.title
    form.value.category = String(material.category?.id || '')
    form.value.description = material.description
    form.value.tags = (material.tags || []).map((item) => item.name).join(', ')
  } catch (error) {
    pushToast(errorMessage(error), 'error')
    router.replace({ name: 'materials' })
  }
})
</script>

<template>
  <div class="container upload">
    <RouterLink class="back" :to="{ name: 'materials' }">
      <AppIcon name="chevronLeft" :size="14" />
      返回资料库
    </RouterLink>

    <header class="upload__head">
      <h1>{{ isEditing ? '修改资料并重新提交' : isAdmin ? '直接上传资料' : '提交上传资料' }}</h1>
      <p class="text-small text-muted">
        支持 {{ ALLOWED_EXTENSIONS.join(' / ') }}，单个文件不超过 {{ maxSizeLabel }}。
      </p>
      <p class="upload__notice">
        <AppIcon :name="isAdmin ? 'check' : 'info'" :size="14" />
        <span v-if="isEditing">保存后重新进入审核队列，管理员通过后会再次出现在资料库。</span>
        <span v-else-if="isAdmin">管理员上传后即时发布到公开资料库。</span>
        <span v-else>提交后进入审核队列，管理员通过后才会出现在公开资料库。</span>
      </p>
    </header>

    <form class="card upload__form" @submit.prevent="submit">
      <label class="field">
        <span class="field__label">资料标题<span class="field__required">*</span></span>
        <input
          v-model="form.title"
          class="input"
          type="text"
          maxlength="200"
          placeholder="例如：中国自然地理分区概述"
        />
        <span v-if="errors.title" class="field__error">{{ errors.title }}</span>
      </label>

      <label class="field">
        <span class="field__label">所属分类<span class="field__required">*</span></span>
        <select v-model="form.category" class="select" :disabled="!categories.length">
          <option value="" disabled>{{ categories.length ? '请选择分类' : '分类加载中…' }}</option>
          <option v-for="item in categories" :key="item.id" :value="String(item.id)">
            {{ item.name }}
          </option>
        </select>
        <span v-if="errors.category" class="field__error">{{ errors.category }}</span>
      </label>
      <!-- 分类取不到时给出原因与重试入口（放 label 外面，避免按钮的可访问名称被 label 文本污染） -->
      <p v-if="categoriesError" class="field__error">
        {{ categoriesError }}
        <button class="btn btn--secondary btn--sm" type="button" @click="loadCategories">
          重新加载分类
        </button>
      </p>

      <label class="field">
        <span class="field__label">标签</span>
        <input
          v-model="form.tags"
          class="input"
          type="text"
          placeholder="用逗号分隔，例如：气候, 地貌, 复习"
        />
        <span class="field__hint">最多展示 3 个标签，建议 2–4 个关键词。</span>
      </label>

      <label class="field">
        <span class="field__label">内容简介</span>
        <textarea
          v-model="form.description"
          class="textarea"
          maxlength="2000"
          placeholder="简单说明资料覆盖的章节、适用场景或使用建议。"
        />
      </label>

      <div class="field">
        <span class="field__label">资料文件<span class="field__required">*</span></span>

        <!-- 拖拽式上传区：默认虚线边框，hover 变实线并加深 -->
        <div
          class="dropzone"
          :class="{ 'is-dragging': dragging, 'is-filled': !!file }"
          role="button"
          tabindex="0"
          @click="fileInput?.click()"
          @keydown.enter.prevent="fileInput?.click()"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="handleDrop"
        >
          <AppIcon :name="file ? 'check' : 'upload'" :size="26" />
          <p v-if="file" class="dropzone__file">
            <strong>{{ file.name }}</strong>
            <span class="num text-muted">{{ formatSize(file.size) }}</span>
          </p>
          <template v-else>
            <p class="dropzone__title">把文件拖到这里，或点击选择</p>
            <p class="dropzone__hint text-small">
              {{ ALLOWED_EXTENSIONS.join(' / ') }} · 最大 {{ maxSizeLabel }}
            </p>
          </template>
        </div>
        <input
          ref="fileInput"
          class="dropzone__input"
          type="file"
          :accept="acceptAttr"
          @change="handleInputChange"
        />
        <span v-if="errors.file" class="field__error">{{ errors.file }}</span>
        <span v-if="isEditing && !file" class="field__hint">不重新选择文件则保留原文件。</span>

        <div v-if="submitting" class="progress">
          <div class="progress__bar" :style="{ width: `${progress}%` }" />
        </div>
      </div>

      <div class="upload__actions">
        <button class="btn btn--primary" type="submit" :disabled="submitting">
          {{ submitting ? `上传中… ${progress}%` : '发布资料' }}
        </button>
        <RouterLink class="btn btn--text" :to="{ name: 'materials' }">取消</RouterLink>
      </div>
    </form>
  </div>
</template>

<style scoped>
.upload {
  padding-top: 24px;
  padding-bottom: 24px;
  max-width: 760px;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 16px;
  font-size: var(--fs-small);
}

.upload__head {
  margin-bottom: 20px;
}

.upload__head p {
  margin-top: 6px;
}

.upload__notice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px !important;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-hover);
  color: var(--text-2);
  font-size: var(--fs-small);
}

.upload__form {
  padding: 24px;
}

.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 28px 20px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--bg-page);
  color: var(--text-3);
  text-align: center;
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease), border-style var(--dur-fast) var(--ease),
    background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
}

.dropzone:hover,
.dropzone.is-dragging {
  /* hover 时边框变实、颜色加深 */
  border-style: solid;
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.dropzone.is-filled {
  border-style: solid;
  border-color: var(--color-success);
  background: var(--bg-card);
  color: var(--text-1);
}

.dropzone__title {
  color: var(--text-2);
  font-size: var(--fs-h4);
}

.dropzone__hint {
  word-break: break-all;
}

.dropzone__file {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  word-break: break-all;
}

.dropzone__input {
  display: none;
}

.progress {
  height: 4px;
  margin-top: 10px;
  border-radius: var(--radius-pill);
  background: var(--bg-hover);
  overflow: hidden;
}

.progress__bar {
  height: 100%;
  background: var(--color-primary);
  transition: width var(--dur-fast) var(--ease);
}

.upload__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}
</style>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { api, errorMessage } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import StatusPill from '@/components/StatusPill.vue'
import { pushToast } from '@/stores/toast'
import { categoryIcon, fileLabel, formatDate, formatSize } from '@/utils/format'

// 管理员审核台：待审核资料列表 + 通过 / 驳回（驳回必须填理由）
const items = ref([])
const loading = ref(true)
const busyId = ref(null)
// 每行独立的驳回理由输入状态
const rejecting = reactive({})

const pendingCount = computed(() => items.value.length)

async function load() {
  loading.value = true
  try {
    const data = await api.pendingMaterials()
    items.value = Array.isArray(data) ? data : data.results
  } catch (error) {
    pushToast(errorMessage(error), 'error')
    items.value = []
  } finally {
    loading.value = false
  }
}

async function approve(item) {
  busyId.value = item.id
  try {
    await api.reviewMaterial(item.id, { action: 'approve' })
    items.value = items.value.filter((row) => row.id !== item.id)
    pushToast(`已通过《${item.title}》`, 'success')
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  } finally {
    busyId.value = null
  }
}

async function reject(item) {
  const state = rejecting[item.id]
  const note = (state?.note || '').trim()
  if (!note) {
    pushToast('驳回必须填写理由', 'info')
    return
  }
  busyId.value = item.id
  try {
    await api.reviewMaterial(item.id, { action: 'reject', note })
    items.value = items.value.filter((row) => row.id !== item.id)
    pushToast(`已驳回《${item.title}》`, 'success')
  } catch (error) {
    pushToast(errorMessage(error), 'error')
  } finally {
    busyId.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="container review">
    <header class="review__head">
      <div>
        <h1>资料审核</h1>
        <p class="text-small text-muted">
          待审核 <span class="num">{{ pendingCount }}</span> 份。通过后资料才会出现在公开资料库。
        </p>
      </div>
      <button class="btn btn--secondary btn--sm" type="button" @click="load">
        <AppIcon name="sort" :size="16" />
        刷新
      </button>
    </header>

    <div v-if="loading" class="card review__empty">加载中…</div>

    <EmptyState
      v-else-if="!items.length"
      title="没有待审核的资料"
      description="用户提交的新资料会出现在这里。"
    >
      <template #action>
        <RouterLink class="btn btn--secondary" :to="{ name: 'materials' }">回到资料库</RouterLink>
      </template>
    </EmptyState>

    <ul v-else class="review__list">
      <li v-for="item in items" :key="item.id" class="card review-item">
        <div class="review-item__main">
          <div class="review-item__top">
            <span class="review-item__cat">
              <AppIcon :name="categoryIcon(item.category?.slug)" :size="14" />
              {{ item.category?.name }}
            </span>
            <StatusPill :status="item.status" />
            <span class="review-item__file">
              {{ fileLabel(item.file_ext) }} · {{ formatSize(item.file_size) }}
            </span>
          </div>

          <RouterLink
            class="review-item__title"
            :to="{ name: 'material-detail', params: { id: item.id } }"
          >
            {{ item.title }}
          </RouterLink>
          <p class="review-item__desc">{{ item.description || '（提交者未填写简介）' }}</p>
          <p class="review-item__meta text-small text-muted">
            提交者 {{ item.uploader?.display_name }} · {{ formatDate(item.created_at) }}
          </p>

          <div v-if="rejecting[item.id]?.open" class="review-item__reject">
            <textarea
              v-model="rejecting[item.id].note"
              class="textarea"
              maxlength="200"
              placeholder="填写驳回理由（会展示给提交者，必填）"
            />
            <div class="review-item__reject-actions">
              <button
                class="btn btn--text btn--sm"
                type="button"
                @click="rejecting[item.id] = { open: false, note: '' }"
              >
                取消
              </button>
              <button
                class="btn btn--primary btn--sm"
                type="button"
                :disabled="busyId === item.id"
                @click="reject(item)"
              >
                确认驳回
              </button>
            </div>
          </div>
        </div>

        <div class="review-item__actions">
          <button
            class="btn btn--primary btn--sm"
            type="button"
            :disabled="busyId === item.id"
            @click="approve(item)"
          >
            <AppIcon name="check" :size="16" />
            通过
          </button>
          <button
            class="btn btn--secondary btn--sm"
            type="button"
            :disabled="busyId === item.id"
            @click="
              rejecting[item.id] = { open: true, note: rejecting[item.id]?.note || '' }
            "
          >
            <AppIcon name="close" :size="16" />
            驳回
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.review {
  padding-top: 28px;
  padding-bottom: 24px;
}

.review__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.review__head p {
  margin-top: 4px;
}

.review__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.review-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;
}

.review-item__main {
  flex: 1;
  min-width: 0;
}

.review-item__top {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.review-item__cat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: var(--fs-small);
}

.review-item__file {
  color: var(--text-3);
  font-size: var(--fs-small);
}

.review-item__title {
  display: block;
  margin: 8px 0 4px;
  color: var(--text-1);
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
}

.review-item__title:hover {
  color: var(--color-primary);
}

.review-item__desc {
  color: var(--text-2);
  font-size: var(--fs-small);
  line-height: var(--lh-body);
}

.review-item__meta {
  margin-top: 6px;
}

.review-item__reject {
  margin-top: 12px;
}

.review-item__reject-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.review-item__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: none;
}

@media (max-width: 1024px) {
  .review-item {
    flex-direction: column;
  }

  .review-item__actions {
    flex-direction: row;
  }
}
</style>

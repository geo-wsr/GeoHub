<script setup>
import { ref } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  maxlength: { type: [Number, String], default: 5000 },
  rows: { type: Number, default: 8 },
})

const emit = defineEmits(['update:modelValue'])

const textareaRef = ref(null)

// 轻量工具栏：只做"在光标处插入语法"，不做富文本（保持纯 Markdown 源码可编辑）
const TOOLS = [
  { label: '粗体', hint: '**粗体**', wrap: ['**', '**'], sample: '粗体' },
  { label: '斜体', hint: '*斜体*', wrap: ['*', '*'], sample: '斜体' },
  { label: '代码', hint: '`代码`', wrap: ['`', '`'], sample: '代码' },
  { label: '引用', hint: '> 引用', prefix: '> ' },
  { label: '列表', hint: '- 列表项', prefix: '- ' },
  { label: '链接', hint: '[文字](https://)', wrap: ['[', '](https://)'], sample: '链接文字' },
]

function applyTool(tool) {
  const el = textareaRef.value
  if (!el) return

  const value = props.modelValue || ''
  const start = el.selectionStart
  const end = el.selectionEnd
  let next
  let cursor

  if (tool.prefix) {
    // 行首插入前缀（引用 / 列表）
    const lineStart = value.lastIndexOf('\n', Math.max(start - 1, 0)) + 1
    next = value.slice(0, lineStart) + tool.prefix + value.slice(lineStart)
    cursor = start + tool.prefix.length
  } else {
    const [before, after] = tool.wrap
    const text = value.slice(start, end) || tool.sample || ''
    next = value.slice(0, start) + before + text + after + value.slice(end)
    cursor = start + before.length + text.length
  }

  emit('update:modelValue', next)
  // 等 v-model 更新后再把焦点与光标放回原位
  window.requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(cursor, cursor)
  })
}
</script>

<template>
  <div class="md-editor">
    <div class="md-editor__bar">
      <button
        v-for="tool in TOOLS"
        :key="tool.label"
        class="md-editor__btn"
        type="button"
        :title="tool.hint"
        @click="applyTool(tool)"
      >
        {{ tool.label }}
      </button>
      <span class="md-editor__tip">支持 Markdown</span>
    </div>
    <textarea
      ref="textareaRef"
      class="textarea md-editor__input"
      :value="modelValue"
      :placeholder="placeholder"
      :maxlength="maxlength"
      :rows="rows"
      @input="emit('update:modelValue', $event.target.value)"
    />
  </div>
</template>

<style scoped>
.md-editor {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
}

.md-editor:focus-within {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
}

.md-editor__bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-hover);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.md-editor__btn {
  padding: 2px 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  font-size: var(--fs-small);
  cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
}

.md-editor__btn:hover {
  background: var(--bg-card);
  color: var(--color-primary);
}

.md-editor__tip {
  margin-left: auto;
  color: var(--text-3);
  font-size: var(--fs-small);
}

.md-editor__input {
  border: 0;
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  background: transparent;
  resize: vertical;
}

.md-editor__input:focus {
  /* 聚焦样式由外层容器统一表现，避免双层描边 */
  box-shadow: none;
}
</style>

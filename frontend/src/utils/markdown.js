import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'

/**
 * 论坛正文 / 楼层回复 / 资料评论共用的 Markdown 渲染器（方案 A：前端渲染）。
 *
 * 安全要点（三条缺一不可）：
 *   1. `html: false` —— 禁用原始 HTML，用户写的 <script>、<img onerror> 会原样转义显示
 *   2. 渲染结果再过一遍 DOMPurify 白名单清洗，兜住 javascript: 链接等漏网情况
 *   3. 外链统一加 target=_blank + rel="noopener noreferrer nofollow"
 * 另外后端对正文/回复/评论都有长度上限，避免超长 Markdown 拖垮渲染。
 */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  // 单个换行也视为换行：与本项目原来的 pre-wrap 展示习惯一致，中文写作更自然
  breaks: true,
  typographer: false,
})

const defaultLinkOpen =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  token.attrSet('target', '_blank')
  token.attrSet('rel', 'noopener noreferrer nofollow')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

const defaultImage =
  md.renderer.rules.image ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  token.attrSet('loading', 'lazy')
  token.attrSet('referrerpolicy', 'no-referrer')
  return defaultImage(tokens, idx, options, env, self)
}

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'hr',
    'strong',
    'em',
    'del',
    'code',
    'pre',
    'blockquote',
    'ul',
    'ol',
    'li',
    'a',
    'img',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  ALLOWED_ATTR: [
    'href',
    'title',
    'alt',
    'src',
    'target',
    'rel',
    'loading',
    'referrerpolicy',
    'class',
  ],
  // 只允许 http(s)、邮件、页内锚点与站内绝对路径；javascript:、data: 一律拦掉
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#|\/(?!\/))/i,
  // ⚠️ 关键：DOMPurify 会用上面的 ALLOWED_URI_REGEXP 去校验"允许列表里那些非 URI 属性"的值，
  // 于是 target="_blank"（_blank 不像 URI）会被整条删掉。把这类属性声明为
  // URI 安全属性后，DOMPurify 就不再校验它们的值，外链的 target/rel 才能保留。
  ADD_URI_SAFE_ATTR: ['target', 'rel', 'loading', 'referrerpolicy'],
}

/** 把 Markdown 源码渲染成可安全插入 DOM 的 HTML 字符串 */
export function renderMarkdown(source) {
  if (!source) return ''
  return DOMPurify.sanitize(md.render(String(source)), PURIFY_CONFIG)
}

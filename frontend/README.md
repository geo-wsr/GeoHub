# frontend · Vue 3 前端

GeoHub 的前台单页应用，构建产物发布到 **GitHub Pages**（或由 Django 在本地托管）。
详细部署步骤见仓库根目录的 [`docs/github-integration.md`](../docs/github-integration.md)。

## 命令

```bash
npm install
npm run dev      # http://127.0.0.1:5173，已配好到后端 8000 的代理
npm run build    # 产物输出到 dist/
npm run preview  # 本地预览构建产物
```

## 两个环境变量

复制 `.env.example` 为 `.env.local`（已被 gitignore）后按需修改。

| 变量 | 作用 | 取值 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 后端接口地址 | 留空 → 走 Vite 代理（仅开发）；生产填 `https://api.example.com` |
| `VITE_BASE_PATH` | 构建资源前缀 | 留空 → `/static/`（交给 Django）；Pages 仓库子路径 → `/<仓库名>/`；自定义域名 → `/` |

> `VITE_BASE_PATH` **同时决定资源前缀与 Vue Router 的 history base**
> （`createWebHistory(import.meta.env.BASE_URL)`），两者必须一致，否则子路由会错位。

## 构建时自动做的事

`vite.config.js` 里的 `spaFallback` 插件会在构建结束时把 `index.html` 复制为 `404.html`。
GitHub Pages 没有服务端重写规则，缺了它子路由刷新就会 404。

## 与后端的约定

- 所有接口挂在后端 `/api/` 前缀下，前端通过 `src/api/index.js` 统一封装
- 跨域部署时前端**读不到后端的 csrftoken Cookie**，CSRF token 由 `/api/auth/csrf/`
  的响应体下发并缓存在内存；登录/登出后 Django 会轮换 token，需重新调用 `ensureCsrf()`
- 请求一律 `withCredentials: true`，后端需在 `CORS_ALLOWED_ORIGINS` 里放行本前端源

## 目录

```
src/
├── api/index.js      # axios 实例、CSRF 拦截器、接口封装
├── router/index.js   # 路由表 + 登录/管理员守卫
├── stores/           # theme（主题持久化）、auth、notification、toast
├── assets/           # tokens.css（设计令牌）、base.css（基础样式）
├── components/       # 通用组件（卡片、楼层、评论区、状态标签…）
└── views/            # 页面（首页、资料库、论坛、个人中心、审核台…）
```

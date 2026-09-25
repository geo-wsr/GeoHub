# GeoHub · 地理学学习资料共享平台

面向地理学专业的前后端分离站点：一侧是带**上传审核**的学习资料库，一侧是带**楼层讨论**的论坛社区。
前台是 Vue 单页应用，后端只提供 REST API 与中文管理后台。

| 层 | 技术 |
| --- | --- |
| 前台 | Vue 3 · Vue Router · Vite · axios（设计令牌 + 深浅双主题） |
| 后端 | Django 5.2 LTS · Django REST Framework · django-allauth |
| 后台 | Django Admin + SimpleUI（简体中文） |
| 部署 | 前台 → GitHub Pages（静态托管）；后端 → 云服务器（gunicorn + Nginx） |
| 数据库 | 开发用 SQLite；生产建议 PostgreSQL |

## 功能

- **资料库**：分类筛选、标题/简介/标签模糊搜索、按最新或下载量排序、分页
- **上传审核**：普通用户提交进审核队列，管理员通过/驳回（驳回必填理由）；
  作者可查看状态与驳回原因，修改后重新提交
- **审核流水与站内通知**：提交/通过/驳回/重提全程留痕；审核结果与回复通过站内通知推送
- **论坛社区**：6 个板块、帖子列表（最新/热门）、发帖与编辑、楼层式回复（含二级）、置顶与精华
- **互动**：两级评论（可编辑并标记"已编辑"）、收藏、下载量统计与下载记录
- **个人中心**：我的上传（带审核状态）/ 收藏 / 帖子 / 回复 / 评论 / 下载记录 / 站内通知
- **三级权限**：游客只读；注册用户可下载、评论、发帖、提交上传；管理员可审核与管理全站内容
- **GitHub 登录**：基于 django-allauth 的 OAuth，登录用户默认普通权限
- **界面**：简约学术风、等高线纹理、深浅双主题（状态持久化）、骨架屏与平滑过渡

## 快速开始

### 1. 后端

```powershell
cd D:\mywebsite\backend
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env          # 按需修改；.env 已被 gitignore
..\.venv\Scripts\python.exe manage.py migrate
..\.venv\Scripts\python.exe manage.py seed_data --demo   # 可选：5 个分类 + 示例资料/帖子
..\.venv\Scripts\python.exe manage.py runserver          # http://127.0.0.1:8000
```

创建管理员：`manage.py createsuperuser`，后台入口 <http://127.0.0.1:8000/admin/>。

### 2. 前端

```powershell
cd D:\mywebsite\frontend
npm install
npm run dev      # http://127.0.0.1:5173，已配好到 8000 的接口代理
```

打包由 Django 托管：`npm run build`（产物进 `frontend/dist`，Django 会自动托管最新版本）。

### 3. 环境变量

所有密钥与域名都通过环境变量注入，代码里不硬编码：

| 变量 | 说明 |
| --- | --- |
| `DJANGO_SECRET_KEY` / `DJANGO_DEBUG` / `DJANGO_ALLOWED_HOSTS` | Django 基础配置 |
| `FRONTEND_URL` | 前端站点地址（OAuth 登录后跳回这里） |
| `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` | 跨域与跨站写请求白名单 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth 应用凭据 |

完整清单见 [`backend/.env.example`](backend/.env.example)。

## 测试

```powershell
cd D:\mywebsite\backend
..\.venv\Scripts\python.exe manage.py test web     # 28 个接口用例
```

覆盖三级权限矩阵、上传审核闭环、论坛楼层结构、编辑权限与站内通知。

## 部署

- 前台：推送到 `main` 后由 [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)
  构建并发布到 GitHub Pages
- 后端：[`.github/workflows/deploy-backend.yml`](.github/workflows/deploy-backend.yml)
  通过 SSH 拉代码 → 装依赖 → 迁移 → 重启 systemd 服务
- 服务器样例配置： [`deploy/`](deploy/)（systemd unit、Nginx 反向代理）

**详细步骤（Pages 开启、自定义域名、Secrets 配置、服务器准备、OAuth 创建）见
[`docs/github-integration.md`](docs/github-integration.md)。**

## 目录结构

```
GeoHub/
├── .github/workflows/     # 前端 Pages 部署、后端 SSH 部署
├── backend/               # Django 后端（manage.py / web 应用 / 迁移 / 测试）
├── frontend/              # Vue 3 前端（组件 / 视图 / 设计令牌）
├── deploy/                # systemd 与 Nginx 样例
├── docs/                  # GitHub 集成操作手册
└── AGENTS.md              # 面向 AI 编码代理的项目约定与踩坑记录
```

## 安全提示

- 仓库不包含任何真实密钥：`.env`、`db.sqlite3`、`media/`、`node_modules/`、`dist/` 均已被忽略
- 上线前务必：`DJANGO_DEBUG=False`、设置随机 `DJANGO_SECRET_KEY` 与 `DJANGO_ALLOWED_HOSTS`、
  执行 `collectstatic`，并用 gunicorn + Nginx 替代 `runserver`

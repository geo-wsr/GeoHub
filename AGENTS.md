# AGENTS.md

本文件面向在此仓库中工作的 AI 编码代理（Codex 等），说明项目结构、环境约束与协作约定。
人类协作者也可以把它当作速查手册。**改动本项目前请先读完第 3 节（环境约束）。**

---

## 1. 项目概览

前后端分离的 Web 项目：前台由 Vue SPA 渲染，后端只提供 API 与管理后台。

| 层 | 技术 | 版本 |
| --- | --- | --- |
| 前台 | Vue · Vue Router · Vite · axios | 3.5.43 · 5.3.1 · 8.3.1 · 1.20.0 |
| 后端 | Django（LTS） | 5.2.17 |
| 接口 | Django REST Framework | 3.18.1 |
| 后台 | Django Admin + SimpleUI | 2026.1.13 |
| 数据库 | SQLite（仅开发用，`db.sqlite3`） | — |
| 运行时 | Python / Node / npm | 3.13.15 / 24.13.0 / 11.6.2 |

- 语言与时区：`LANGUAGE_CODE = 'zh-hans'`、`TIME_ZONE = 'Asia/Shanghai'`
- 三级角色：游客（只读）/ 注册用户（下载、评论、发帖、提交上传）/ 管理员（审核、管理全站内容）
- 前台三大入口：首页 / 资料库 / 论坛；细分分类与板块在页面侧边栏切换
- 本仓库目前**不是 git 仓库**（无 `.git`），提交历史无从追溯
- 所有源码使用 UTF-8，注释与界面文案为中文

## 2. 目录结构

```
mywebsite/
├── manage.py
├── requirements.txt          # 后端依赖（已固定版本）
├── db.sqlite3                # 开发数据库（已 gitignore）
├── .venv/                    # Python 虚拟环境（已 gitignore）
├── mywebsite/                # Django 项目配置
│   ├── settings.py           # INSTALLED_APPS / 中文与时区 / 静态文件
│   ├── urls.py               # 路由总入口：admin → api → SPA catch-all
│   ├── asgi.py / wsgi.py
├── web/                      # 唯一的业务应用
│   ├── models.py             # Category / Tag / Material / Comment / Favorite / DownloadRecord
│   ├── admin.py              # 上述六个模型的后台注册
│   ├── serializers.py        # DRF 序列化器（上传校验、标签 get_or_create、两级评论）
│   ├── api.py                # 视图：资料、评论、收藏、下载、个人中心、认证
│   ├── api_urls.py           # /api/ 路由（DefaultRouter + 认证函数视图）
│   ├── pagination.py         # 统一分页（默认 12 条，上限 48）
│   ├── views.py              # spa_index：返回构建产物或跳转 Vite
│   ├── management/commands/seed_data.py   # 分类与示例资料初始化
│   └── migrations/
└── frontend/                 # Vue 前端工程
    ├── package.json / package-lock.json
    ├── vite.config.js        # 代理、别名、构建 base
    ├── index.html / public/favicon.svg
    ├── dist/                 # 构建产物（已 gitignore，由 npm run build 生成）
    └── src/
        ├── main.js / App.vue       # 应用外壳：等高线纹理 + 路由淡入淡出
        ├── router/index.js         # 路由表 + 登录守卫 + 标题
        ├── api/index.js            # axios 实例、CSRF 拦截器、接口封装
        ├── stores/                 # theme（含 localStorage 持久化）、auth、toast
        ├── utils/format.js         # 时间 / 文件大小 / 分类图标映射
        ├── assets/tokens.css       # 设计令牌：浅色 + 深色两套 CSS 变量
        ├── assets/base.css         # 重置、排版、按钮、表单、卡片、骨架屏
        ├── components/             # AppHeader / MaterialCard / TopicCard / FloorItem /
        │                           # CommentSection / StatusPill / PaginationBar / …
        └── views/                  # Home / MaterialList / MaterialDetail / Upload / Profile / Login
                                    # ForumList / TopicDetail / NewTopic / Search / Review / NotFound
```

## 3. 环境约束（重要）

### 3.1 解释器位置

| 用途 | 路径 |
| --- | --- |
| 系统 Python 3.13.15 | `C:\Users\wsr13\AppData\Local\Programs\Python\Python313\python.exe`（已在用户 PATH 首位） |
| 项目虚拟环境 | `D:\mywebsite\.venv`（`Scripts\python.exe`） |
| Node 24.13.0 / npm 11.6.2 | `C:\Program Files\nodejs\` |

### 3.2 沙箱行为（实测结论）

- **Codex 沙箱内无法执行 `.venv\Scripts\python.exe`**，报 `Unable to create process`。
  原因是虚拟环境的基础解释器位于工作区之外。→ **所有 Django / Python 命令都必须提权执行**。
- `node` / `npm` 本体可以在沙箱内调用（`node -v`、`npm -v` 正常），但
  `npm run build` 需要写 `node_modules/.vite-temp`，沙箱内会直接失败：
  `EPERM: operation not permitted, mkdir ...vite-temp`；`npm run dev` 同样要写 Vite 缓存目录。
  → **前端的 dev / build 命令一律按需要提权处理。**
- `npm install`、`pip install` 需要网络，**必须提权**。
- 沙箱内的 `Get-NetTCPConnection -State Listen` 看不到工作区外进程的端口，
  8000 明明在监听也会返回空。→ 端口检查必须提权。

### 3.3 工作区

可写根目录为 `D:\mywebsite`。工作区之外的写入（如用户 PATH、全局环境）需要提权。

## 4. 常用命令

后端（**需提权**，或在你自己的系统终端执行）：

```powershell
cd D:\mywebsite
.\.venv\Scripts\Activate.ps1          # 或直接用 .\.venv\Scripts\python.exe
python manage.py runserver            # 监听 127.0.0.1:8000
python manage.py check
python manage.py makemigrations       # 改过 models.py 之后
python manage.py migrate
python manage.py collectstatic        # 部署前
python manage.py seed_data --demo     # 建 5 个分类 + 3 份示例资料
python manage.py seed_data --clear-demo  # 删除示例资料
```

前端（沙箱内可执行 `dev`，构建建议提权）：

```powershell
cd D:\mywebsite\frontend
npm run dev        # http://127.0.0.1:5173，热更新
npm run build      # 产出 dist/，Django 随后托管新版本
npm run preview
```

停止后台的 Django 开发服务器：

```powershell
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  Where-Object { $_.CommandLine -like '*manage.py*runserver*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

## 5. 架构与路由约定

请求进入 Django 后的分工（见 `mywebsite/urls.py`）：

```
/api/*    → web.api_urls（DRF，返回 JSON）
/admin/*  → Django Admin + SimpleUI（中文）
其余      → web.views.spa_index
              已构建 frontend/dist/index.html → 直接返回
              未构建 → 302 跳转到 http://127.0.0.1:5173/
```

要点：

- 前台**不再使用 Django 模板**。给 Vue 的页面数据一律新增 DRF 接口，不要往 `views.py` 里加渲染逻辑。

### 接口一览（前缀 `/api/`）

| 方法与路径 | 说明 |
| --- | --- |
| `GET categories/`、`GET tags/?hot=8` | 分类（带 `material_count`）与标签 |
| `GET materials/` | 列表，参数：`category` `tag` `search` `ordering`(`new`/`downloads`/`favorites`/`oldest`) `mine` `status` `page` `page_size`。**默认只返回 `is_public=True` 且 `status=approved`** |
| `POST materials/` | 上传（multipart：`title` `category` `description` `tags` `file`），需登录。管理员→直接 `approved`；普通用户→进 `pending` 队列 |
| `GET materials/{id}/` | 详情 |
| `PATCH/DELETE materials/{id}/` | 仅上传者或 staff（管理员可改全站资料） |
| `GET materials/{id}/download/` | **必须登录**；返回文件、累加 `download_count`、写下载记录 |
| `POST materials/{id}/favorite/` | 收藏/取消收藏开关，需登录 |
| `POST materials/{id}/review/` | **仅管理员**；`{action: approve\|reject, note}`，驳回必须填 `note` |
| `GET\|POST materials/{id}/comments/` | 一级评论（含内联 replies，倒序、可分页）；POST 需登录 |
| `PATCH\|DELETE comments/{id}/` | 编辑 / 删除；仅作者或 staff，编辑会打 `edited_at` |
| `GET materials/latest/`、`hot/`、`{id}/related/` | 首页与详情页聚合 |
| `GET boards/` | 论坛板块（6 个，带 `topic_count`） |
| `GET topics/` | 帖子列表，参数：`board` `tag` `search` `ordering`(`new`/`hot`/`views`) `page` |
| `POST topics/`、`PATCH/DELETE topics/{id}/` | 发帖需登录；改删仅作者或 staff |
| `GET\|POST topics/{id}/posts/` | 楼层回复（一级按时间正序、含二级 replies、分页）；POST 需登录 |
| `PATCH\|DELETE posts/{id}/` | 编辑 / 删除；仅作者或 staff，编辑会打 `edited_at` |
| `POST topics/{id}/pin/`、`feature/` | **仅管理员**：置顶 / 加精开关（置顶帖在列表最前） |
| `POST auth/csrf\|login\|logout\|register/`、`GET auth/me/` | 会话认证；`auth/csrf/` 用于拿 csrftoken |
| `GET search/?q=` | 全局搜索，同时返回 `materials` 与 `topics` |
| `GET profile/`、`favorites/`、`my-comments/`、`downloads/`、`my-topics/`、`my-posts/` | 个人中心（需登录） |
| `GET notifications/`、`unread_count/`、`POST mark_all_read/`、`POST {id}/mark_read/` | 站内通知（需登录） |

### 权限矩阵

| 能力 | 游客 | 注册用户 | 管理员 |
| --- | --- | --- | --- |
| 浏览资料列表/详情、论坛帖子 | ✅ | ✅ | ✅ |
| 下载资料、发表评论与回复 | ❌（403） | ✅ | ✅ |
| 发帖、楼层回复 | ❌（403） | ✅ | ✅ |
| 提交资料上传 | ❌ | ✅（进审核队列） | ✅（直传即通过） |
| 删除自己的资料/帖子/评论/回复 | ❌ | ✅ | ✅ |
| 置顶 / 加精帖子 | ❌ | ❌ | ✅ |
| 审核资料、管理全站内容 | ❌ | ❌ | ✅ |

前端在路由 `meta` 上做同名守卫（`requiresAuth` / `requiresAdmin`），后端在每个 action 上独立校验——**两边都要改**。
- SPA 使用 history 模式，前端路由刷新依赖上面的 catch-all；迁移到 Nginx 时要配 `try_files $uri $uri/ /index.html`。
- Vite 构建时 `base = '/static/'`，产物参与 Django 的 `STATICFILES_DIRS`；
  因此**改完前端必须 `npm run build`**，Django 才会托管最新版本。
- 开发时 Vite 把 `/api`、`/admin`、`/static` 反向代理到 8000，所以 5173 上可以直接调接口和进后台。

## 6. 代码约定

- Python：4 空格缩进、字符串用单引号（与 Django 生成代码一致）、模型字段带中文 `verbose_name`。
- JavaScript / Vue：2 空格缩进、**不加行尾分号**、单引号、用 `@/` 别名指向 `src/`。
- Vue 组件统一用 `<script setup>` + Composition API。
- 界面文案与注释写中文；接口路径用英文小写加连字符（如 `/api/site-info/`）。

## 7. 变更纪律（踩过的坑）

1. **先装依赖，再改 `settings.py`。**
   开发服务器常驻 `StatReloader`，配置一改就立即重载。若 `INSTALLED_APPS` 里先写了
   `rest_framework` 而包还没装上，重载会以 `ModuleNotFoundError` 崩溃退出
   （本项目已踩过一次，残留 8 个僵尸进程，需手动清理后重启）。
2. Django 的 `StatReloader` **只监听 Python 模块文件**：改写 `db.sqlite3`、前端源码或
   `AGENTS.md` 都**不会**触发后端重载（已实测）。所以改完前端务必重新 `npm run build`，
   否则 Django 托管的仍是旧产物。
3. 写验证脚本时避开 PowerShell 内置只读变量：`$home`、`$host`、`$error`、`$input`、`$args`、`$matches`。
   `$home = ...` 会抛 `Cannot overwrite variable HOME`；若同时设了
   `$ErrorActionPreference = 'SilentlyContinue'`，错误会被吞掉并伪装成"接口不可用"的假故障。
4. 编辑文件保持 UTF-8、不加 BOM，中文字符串不要被转码。
5. **DRF 的 `BooleanField` 在 multipart 表单里缺失时会被判定为 `False`**
   （`default_empty_html = False`）。资料上传接口因此显式补了 `is_public=True` 默认值
   （`MaterialWriteSerializer.validate`）。新增布尔字段时注意同样的坑：
   症状是"上传成功但资料立刻在列表里消失"，排查方向就是这条。
6. **重写 `get_permissions()` 会覆盖 `@action(permission_classes=...)` 的声明。**
   `MaterialViewSet.download` 曾因此漏在白名单外，游客请求直接进入函数体，
   抛 `ValueError: Cannot assign AnonymousUser`（500）。→ 新增需登录的 action 时必须在
   `get_permissions()` 里显式列出。
   **同一个坑在 `TopicViewSet.pin/feature` 上重犯过一次**（普通用户能把帖子置顶）。
   → 每个 viewset 重写 `get_permissions()` 后，务必逐个 action 过一遍权限表。
7. 标签输入统一走 `split_tag_names()`：`a, b` 与 `a，b` 都会拆成两个标签，
   不会生成含逗号的垃圾标签。
8. 详情/写操作的查询集要单独放行"本人的未过审资料"：公开列表只有 `approved`，
   若详情也只看 `approved`，作者打开自己被驳回的提交会 404、无法修改重提。
   现在 `retrieve/update/partial_update/destroy` 对作者放行自己的资料、对管理员放行全部。
9. 分类的 `material_count` 只统计"公开且已通过"的资料，否则侧栏计数会多于公开列表条数。

## 8. 验证方式

改完后端至少执行：

```powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py test web     # 28 个接口测试；改权限/审核后必跑
Invoke-WebRequest http://127.0.0.1:8000/api/site-info/ -UseBasicParsing
```

改为前端相关时，除了构建，还应确认：`/` 返回的 HTML 含 `id="app"`、静态资源 200、
`/about` 与首页返回同一份 HTML（证明前端路由接管）。

需要看真实渲染结果时，可用应用内浏览器打开 `http://127.0.0.1:8000/` 并读取无障碍树。

**注意控制台中文乱码**：终端代码页渲染不了中文时，`print` 出来会是乱码，
但数据本身没问题。判断中文是否写对，请打印码点，例如：

```python
print([hex(ord(c)) for c in value])
```

## 9. 项目现状与待办

已完成：

- 前后端分离跑通：前台 Vue 渲染、DRF 提供数据、后台仍为中文 SimpleUI
- 资料上传/下载（格式白名单 + 50 MB 上限校验、下载量统计），下载仅登录用户可用
- 两级评论（登录用户可发帖、回复、删除自己的评论，倒序展示）
- 收藏、个人中心（上传/评论/收藏/下载记录 + 统计）
- 分类筛选、标题/简介/标签/分类名的模糊搜索、排序、分页
- 深浅双主题，状态存 localStorage；设计令牌集中在 `tokens.css`
- **论坛社区**：6 个板块、帖子列表（最新/热门排序）、发帖与编辑、楼层式回复（含二级）、浏览量
- **上传审核**：普通用户提交进队列；管理员审核台 `/review` 通过/驳回（驳回必填理由）；
  个人中心按状态展示（待审核黄 / 已通过绿 / 已驳回红 + 驳回原因）
- 三级权限前后端双重校验；首页「热门讨论」；全局搜索同时匹配资料与帖子
- **自动化测试**：`web/tests.py` 覆盖三级权限、审核闭环、楼层结构、编辑与通知，共 28 个用例
- **审核流水与站内通知**：`ReviewLog` 记录提交/通过/驳回/重提；`Notification` 推送审核结果与回复
  （头部铃铛 + 个人中心「站内通知」页）
- **驳回后重新提交**：作者在资料详情点「修改并重新提交」→ 表单预填 → 保存后自动回到待审核
- **帖子置顶 / 精华**：管理员在帖子详情页操作，置顶帖在列表始终最前
- **评论与楼层回复可编辑**：行内编辑并保留"已编辑"标记
- **接口限流**：全站兜底 + 登录/注册 + 上传三档（见 `web/throttles.py`）
- 演示数据：5 个分类 + 6 个板块 + 3 份示例资料 + 2 个示例帖子，可用 `seed_data --clear-demo` 清除
- 超级管理员已创建（用户名 `quanhezi`；**密码不记录在本文件**，需要时问维护者）

尚未做，接到相关需求时按需补齐：

- 上传无断点续传、无同名文件查重、未做文件内容安全扫描
- 无 @ 提醒、无邮件/短信通知（仅站内通知）；收藏不可分组
- 板块无独立版主（管理动作靠全局 staff）；帖子不能移动板块、不能关闭回复
- 鉴权只有 Session 认证（未接 Token/JWT）；限流用 LocMemCache，多进程部署需换 Redis
- 没有生产配置：`DEBUG=True`、`SECRET_KEY` 是自动生成的不安全值、`ALLOWED_HOSTS` 为空、
  未接入 WhiteNoise/Nginx，媒体文件（`/media/`）在 `DEBUG=False` 下不会被 Django 托管
- 未初始化 git 仓库

## 10. 安全红线

- 不要把 `SECRET_KEY`、管理员密码、API Key 写进源码或本文件。
- 上线前必须：`DEBUG=False`、`SECRET_KEY` 走环境变量、设置 `ALLOWED_HOSTS`、
  执行 `collectstatic`、把 `runserver` 换成正式服务器（gunicorn/waitress + Nginx）。
- 生产环境不要用 `python manage.py runserver`。

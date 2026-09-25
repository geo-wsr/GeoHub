# GitHub 全链路集成说明（Serverless / PaaS 方案）

前后端完全分离部署：**GitHub Pages 只托管 Vue 构建产物**，Django 后端（数据库、上传文件、
论坛/评论/审核等全部动态功能）跑在 PaaS 平台上，两者通过跨域 API 通信。

```
GitHub 仓库（单仓）
├── frontend/   → GitHub Actions 构建 → GitHub Pages（纯静态，无任何后端逻辑）
└── backend/    → GitHub Actions 触发部署钩子 → Render（Django + gunicorn）
                     ├── Neon            → Postgres 数据库（DATABASE_URL）
                     └── Cloudflare R2   → 用户上传的文件（资料 / 论坛图片）
```

**为什么不需要 ICP 备案**：上面四家服务的节点全部在中国大陆境外，域名只加一条 CNAME
指向 Render 的海外入口，境内没有落任何服务器或 CDN 节点，因此不涉及备案（见 3.4）。
**一旦**改成「境内云服务器 / 境内 CDN / 境内对象存储」，就必须先完成备案。

---

## 1. 仓库侧一次性配置

### 1.1 开启 GitHub Pages

1. 打开 **仓库 → Settings → Pages**
2. **Source** 选择 **GitHub Actions**（不要选 "Deploy from a branch"）
3. 保存后无需其他设置，推送 `frontend/` 变更即会自动部署

> ⚠️ 本项目使用**独立仓库**，请确认只在本仓库开启 Pages；
> 个人博客仓库的 Pages 保持关闭，两套项目互不影响。

### 1.2 仓库变量（Variables）

路径：**Settings → Secrets and variables → Actions → Variables**

| 变量名 | 必填 | 说明 |
| --- | --- | --- |
| `API_BASE_URL` | ✅ | 生产后端地址，如 `https://api.example.com`（**不要**结尾斜杠）。先用 Render 默认域名 `https://<服务名>.onrender.com` 也能跑通，绑好自定义域名后改成正式地址 |
| `PAGES_BASE_PATH` | 可选 | 自定义域名填 `/`；留空则自动用 `/<仓库名>/`（仓库子路径部署） |

### 1.3 部署用 Secrets

路径：**Settings → Secrets and variables → Actions → Secrets**

| Secret 名 | 必填 | 说明 |
| --- | --- | --- |
| `RENDER_DEPLOY_HOOK` | ✅ | Render 控制台 → Web Service → **Settings → Deploy Hook**，复制整条 URL |

> 工作流在**未配置**该 Secret 时会打印一条 notice 并安全跳过，不会出现失败的红叉。
> 历史版本曾用 SSH 部署到自建服务器（`SSH_HOST` / `SSH_USER` / `SSH_PRIVATE_KEY` /
> `DEPLOY_PATH` / `SERVICE_NAME`）——这些 Secret 现在**不再使用**，可以删掉，回退方案见第 7 节。

---

## 2. GitHub OAuth 应用

1. 打开 **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
2. 填写：
   - **Application name**：随意，如 `GeoHub`
   - **Homepage URL**：`https://<用户名>.github.io/<仓库名>/`（或自定义域名）
   - **Authorization callback URL**：`https://api.example.com/accounts/github/login/callback/`
     （必须是**后端域名**，allauth 用它接收授权码；暂未绑域名就先用
     `https://<服务名>.onrender.com/accounts/github/login/callback/`）
3. 创建后记录 **Client ID**，并生成 **Client Secret**
4. 把它们填进 Render 的环境变量（见 3.3），**不要**提交到仓库

登录流程：

```
前端登录页「使用 GitHub 登录」
  → 跳转 https://api.example.com/accounts/github/login/?process=login
  → GitHub 授权 → 回调 https://api.example.com/accounts/github/login/callback/
  → 后端建立 Session 并 302 到 <FRONTEND_URL>/oauth/callback
  → 前端回调页拉一次 /api/auth/me/ 落地登录态 → 跳回首页
```

GitHub 登录用户**一律是普通用户**（适配器 `backend/web/adapters.py` 强制 `is_staff=False`），
与现有「游客 / 注册用户 / 管理员」三级权限完全兼容。

---

## 3. 后端：Neon + R2 + Render 一次性配置

顺序建议：**先建数据库和桶 → 再创建 Render 服务 → 最后填环境变量**，
这样服务第一次构建起来就是可用状态。

### 3.1 Neon（Postgres 数据库）

1. 注册 <https://neon.com>，新建 Project（区域选离用户近的，如 `Asia Pacific (Singapore)`）
2. 在 **Connection string** 里选 **Direct connection**（非 pooled），复制形如：
   `postgresql://<user>:<password>@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
3. 这串就是 Render 的 `DATABASE_URL`

> 免费额度对小站足够，长时间无访问会自动挂起，下一次请求会先唤醒（几秒）。
> 若以后改用 **Pooled connection**，遇到 `prepared statement` 相关报错时要额外开
> `DISABLE_SERVER_SIDE_CURSORS`，本项目的默认配置按 Direct 连接最优。
> 不填 `DATABASE_URL` 会回落到本地 SQLite —— 在 PaaS 上等于每次部署丢数据，务必填。

### 3.2 Cloudflare R2（文件存储）

1. Cloudflare 控制台 → **R2 → Create bucket**，名字如 `geohub-media`
2. 进入桶 → **Settings → Public access** → 允许公开访问，记下域名（形如 `pub-xxxx.r2.dev`）
3. **R2 → API → Manage API Tokens** → Create API Token，权限选 **Object Read & Write**，
   范围限定这个桶；记下 **Access Key ID** 与 **Secret Access Key**
4. 桶的 **S3 endpoint** 形如 `https://<account_id>.r2.cloudflarestorage.com`

> R2 不支持对象级 ACL，所以项目里 `AWS_DEFAULT_ACL = None`，桶必须开公开访问；
> 若坚持私有桶，要把 `AWS_QUERYSTRING_AUTH=true`，但论坛图片会变成短期签名地址，
> 富文本里存下来的图片链接过期后就显示不出来了。

#### 备选：Supabase Storage（没有国际卡时用这个）

R2 激活订阅时要求绑定付款方式（信用卡），没有卡就换 Supabase Storage：
免费 1GB 存储 + 5GB/月流量、注册无需绑卡、同样走 S3 协议，**后端代码一行都不用改**，
只是环境变量的值换成 Supabase 给的：

| Render 变量 | 填什么 |
| --- | --- |
| `AWS_STORAGE_BUCKET_NAME` | 桶名，如 `geohub-media`（建桶时必须开 **Public bucket**） |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Project Settings → Storage → S3 access keys 生成 |
| `AWS_S3_ENDPOINT_URL` | `https://<project-ref>.supabase.co/storage/v1/s3` |
| `AWS_S3_REGION_NAME` | 项目真实区域，新加坡为 `ap-southeast-1`（**不能填 `auto`**） |
| `AWS_S3_CUSTOM_DOMAIN` | `<project-ref>.supabase.co/storage/v1/object/public/<桶名>` |

> 取 `<project-ref>`：Project Settings → General → **Project ID**，
> 或看控制台网址里的 `dashboard/project/<ref>` 一段。
> 注意 Supabase 控制台依赖 `api.supabase.com`，在 Codex 应用内浏览器里会被策略拦截，
> 这一步请用系统自带浏览器（Edge / Chrome）操作。

### 3.3 Render（Django 后端）

1. 注册 <https://render.com>（用 GitHub 账号登录）
2. **New → Blueprint** → 选择本仓库 → Render 自动读取根目录 `render.yaml`
3. 创建后会让你补全标了 `sync: false` 的环境变量，按下表填写：

| 变量 | 示例值 | 说明 |
| --- | --- | --- |
| `DJANGO_DEBUG` | `false` | `render.yaml` 已固定 |
| `DJANGO_SECRET_KEY` | 自动生成 | 蓝图里 `generateValue: true`，不用手填 |
| `DJANGO_ALLOWED_HOSTS` | `api.example.com,geohub-api.onrender.com` | 逗号分隔；`RENDER_EXTERNAL_HOSTNAME` 会被自动追加 |
| `FRONTEND_URL` | `https://geo-wsr.github.io/GeoHub` | 登录成功后跳回的前端地址，**不带结尾斜杠** |
| `CORS_ALLOWED_ORIGINS` | `https://geo-wsr.github.io` | 只填**源**（协议+域名，不带仓库路径） |
| `CSRF_TRUSTED_ORIGINS` | `https://geo-wsr.github.io` | 同上，否则跨域写操作全部 403 |
| `DATABASE_URL` | `postgresql://…neon.tech/neondb?sslmode=require` | 见 3.1 |
| `AWS_STORAGE_BUCKET_NAME` | `geohub-media` | **设置了它才会启用对象存储** |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | R2 API Token | 见 3.2 |
| `AWS_S3_ENDPOINT_URL` | `https://<account_id>.r2.cloudflarestorage.com` | 见 3.2 |
| `AWS_S3_REGION_NAME` | `auto` / `ap-southeast-1` | R2 固定 `auto`；Supabase Storage 必须填项目真实区域 |
| `AWS_S3_CUSTOM_DOMAIN` | `pub-xxxx.r2.dev` | 桶的公开域名；填了它 `MEDIA_URL` 才会指向 R2 |
| `AWS_QUERYSTRING_AUTH` | `false` | 公开桶保持 false |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth App 的值 | 见第 2 节 |

构建与启动命令由蓝图提供（等价于手工配置）：

```bash
# Build
pip install -r requirements-prod.txt && python manage.py collectstatic --noinput
# Start
python manage.py migrate --noinput && gunicorn mywebsite.wsgi:application
```

> 免费实例**15 分钟无请求会休眠**，下次访问冷启动约 30–60 秒；个人学习站可以接受，
> 介意的话用外部定时探活（如 UptimeRobot 每 10 分钟打一次 `/api/categories/`）。
> 另外建议在 Render 里**关掉 Auto-Deploy**，否则一次 push 会被 GitHub Actions 和
> Render 自动部署各触发一次。

### 3.4 绑定自定义域名（DNSPod，腾讯云域名）

1. Render → 服务 → **Settings → Custom Domains → Add**，填 `api.example.com`
2. Render 会给出一条 CNAME 目标（形如 `geohub-api.onrender.com`）
3. 腾讯云 **DNSPod → 我的域名 → 解析 → 添加记录**：

| 主机记录 | 记录类型 | 线路 | 记录值 | TTL |
| --- | --- | --- | --- | --- |
| `api` | CNAME | 默认 | Render 给的目标域名 | 600 |

4. 等待 Render 里该域名显示 **Certificate issued**（自动签 HTTPS 证书，几分钟）
5. 回到仓库 **Variables** 把 `API_BASE_URL` 改成 `https://api.example.com`，重跑一次
   `Deploy frontend to GitHub Pages` 工作流；同时更新 Render 的 `DJANGO_ALLOWED_HOSTS`

> 根域名（`example.com`）不能直接加 CNAME，需要 `api` 这类子域，或用 DNSPod 的
> 「显性 URL / ANAME」能力；本项目统一用 `api` 子域最省事。
> 前后端分属 `github.io` 与 `example.com` 时属于**跨站**，Safari 等浏览器可能拦第三方
> Cookie，详见 Q4。

### 3.5 首次初始化（超级管理员 / 演示数据）

Render → 服务 → **Shell**，执行：

```bash
python manage.py createsuperuser          # 建管理员
python manage.py seed_data --demo         # 可选：5 分类 + 6 板块 + 示例资料/帖子
```

> 也可以在本机对着生产库执行（连接串来自 Neon）：
> `$env:DATABASE_URL='postgresql://…'; .\.venv\Scripts\python.exe manage.py createsuperuser`
> 管理员账号请自行保管，**不要**写进仓库或 `AGENTS.md`。

---

## 4. 部署触发方式

| 工作流 | 自动触发 | 手动触发 |
| --- | --- | --- |
| `deploy-pages.yml` | `frontend/**` 推送到 `main` | Actions → Deploy frontend to GitHub Pages → Run workflow |
| `deploy-backend.yml` | `backend/**`、`render.yaml` 推送到 `main` | Actions → Deploy backend to Render → Run workflow |

后端工作流只做一件事：POST 一下 Render 的 Deploy Hook，真正的
构建/迁移/重启在 Render 侧完成，日志在 Render 控制台看。钩子返回非 200/201 时
工作流会报错并打印排查顺序（钩子被轮换 / 服务 suspended / 免费额度用尽）。

---

## 5. 关键配置项速查

| 位置 | 配置 | 作用 |
| --- | --- | --- |
| `render.yaml` | 蓝图定义 | 服务名、构建/启动命令、健康检查、环境变量清单 |
| `backend/requirements-prod.txt` | `-r requirements.txt` + gunicorn | 生产依赖（本地 Windows 不需要 gunicorn） |
| `backend/mywebsite/settings.py` | `DATABASE_URL` | 有则连 Postgres，无则回落 SQLite（`dj-database-url`） |
| `backend/mywebsite/settings.py` | `AWS_STORAGE_BUCKET_NAME` 等 | 有则上传走 R2/S3，无则走本地 `media/` |
| `backend/mywebsite/settings.py` | WhiteNoise 中间件 + `CompressedStaticFilesStorage` | `DEBUG=False` 时由进程直接托管压缩后的 `/static/`（含 SimpleUI） |
| `backend/web/api.py` | `download` action | 本地磁盘→流式下载；对象存储→302 跳转文件地址，省后端带宽 |
| `frontend/vite.config.js` | `VITE_BASE_PATH` | 构建资源前缀（Pages 子路径 / 自定义域名 / 交给 Django 时 `/static/`） |
| `frontend/src/router/index.js` | `VITE_ROUTER_BASE` | 前端路由前缀。Pages 场景与 `VITE_BASE_PATH` 相同；交给 Django 时必须留空（`/`），否则 SPA 会生成 `/static/login` 这类 404 链接 |
| `frontend/vite.config.js` | `spaFallback` 插件 | 构建后生成 `404.html`，子路由刷新不再 404 |
| `frontend/src/api/index.js` | `VITE_API_BASE_URL` | 后端接口地址（开发留空走 Vite 代理） |
| `backend/mywebsite/settings.py` | `CORS_ALLOWED_ORIGINS` | 允许携带 Cookie 的前端源 |
| `backend/mywebsite/settings.py` | `CSRF_TRUSTED_ORIGINS` | 跨站写请求白名单 |
| `backend/mywebsite/settings.py` | `SESSION_COOKIE_SAMESITE=None` 等 | 非 DEBUG 自动切换为跨站 Cookie 策略 |

---

## 6. 常见问题

**Q1. 前端能打开但接口全 502 / 被拦截？**
先确认 `API_BASE_URL` 变量已设置且没有结尾斜杠，再检查后端 `CORS_ALLOWED_ORIGINS`
是否**恰好等于**前端源（`https://user.github.io`，不要带仓库路径）。
首次请求慢 30–60 秒多半是免费实例冷启动，不是故障。

**Q2. 登录后写操作（评论/上传/收藏）403？**
多数是 CSRF：

- 后端 `CSRF_TRUSTED_ORIGINS` 是否包含前端源
- `DJANGO_DEBUG=False` 时 Cookie 才会切成 `SameSite=None; Secure`，跨站请求才带得上
- 前端 token 来自 `/api/auth/csrf/` 响应体（跨域读不到 Cookie），确认没被缓存成登录前的旧值

**Q3. 子路由刷新 404？**
确认构建产物里有 `404.html`（工作流已校验）；自定义域名时确认 `PAGES_BASE_PATH=/`。

**Q4. 浏览器完全不带 Cookie（Safari「阻止跨站跟踪」）？**
GitHub Pages 的前端与 `api.example.com` 属于**不同站点**，Safari 默认会拦掉第三方
Session Cookie（Chrome/Edge 正常）。若要彻底解决：把前端也搬到自有域名的子域
（如 `www.example.com` 由 Cloudflare Pages / Vercel 托管，同样免备案），
让前后端变成「同站不同子域」；这是本方案相对自建服务器的已知取舍。

**Q5. 上传大文件失败？**
后端限制 50 MB（`MATERIAL_MAX_UPLOAD_SIZE`）。Render 的请求体上限比 Nginx 宽松，
一般不用调；若确实失败，先换小文件定位，再考虑改成「前端直传 R2（预签名 URL）」。

**Q6. 上传成功，但资料/图片点开 404？**
检查 `AWS_STORAGE_BUCKET_NAME`、`AWS_S3_CUSTOM_DOMAIN` 是否都填了，
以及 R2 桶是否已开公开访问。只填桶名不填公开域名时，网页会拿不到 `MEDIA_URL`。

**Q7. 部署后报 `Error loading psycopg2 or psycopg module`？**
`psycopg[binary]` 必须留在 `requirements.txt` 里（已固定版本），删掉它 Postgres 就连不上。

---

## 7. 回退方案：自建云服务器

`deploy/` 目录里的 `mywebsite.service.sample`（systemd）与 `nginx.conf.sample`
仍然可用，适合以后换回境内/香港轻量服务器时参考。注意：

- 境内服务器 + 境内域名访问**必须 ICP 备案**（香港/海外节点不需要）
- 需要自己装 Python、配 systemd + Nginx、改 `/etc/mywebsite.env`（变量名与第 3.3 节一致）
- 记得 `client_max_body_size` 要大于 50 MB，并把 `runserver` 换成 gunicorn

---

## 8. 多项目隔离

- 本项目使用**独立仓库** `geo-wsr/GeoHub`，与个人博客仓库完全分离
- Pages 只在**本仓库**开启；博客仓库保持关闭
- Render 服务、Neon 数据库、R2 桶都按项目单独创建，与其他项目不共用密钥/域名

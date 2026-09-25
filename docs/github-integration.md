# GitHub 全链路集成说明

前后端完全分离部署：**GitHub Pages 只托管 Vue 构建产物**，Django 后端（含数据库、上传文件、
论坛/评论/审核等全部动态功能）独立跑在云服务器上，两者通过跨域 API 通信。

```
GitHub 仓库（单仓）
├── frontend/   → GitHub Actions 构建 → 发布到 GitHub Pages（静态）
└── backend/    → GitHub Actions 通过 SSH → 部署到云服务器（gunicorn + Nginx）
```

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
| `API_BASE_URL` | ✅ | 生产后端地址，如 `https://api.example.com`（**不要**结尾斜杠） |
| `PAGES_BASE_PATH` | 可选 | 自定义域名填 `/`；留空则自动用 `/<仓库名>/`（仓库子路径部署） |

### 1.3 部署用 Secrets

路径：**Settings → Secrets and variables → Actions → Secrets**

| Secret 名 | 必填 | 说明 |
| --- | --- | --- |
| `SSH_HOST` | ✅ | 云服务器 IP 或域名 |
| `SSH_USER` | ✅ | 部署用户（建议专用 `deploy` 账号） |
| `SSH_PRIVATE_KEY` | ✅ | 部署私钥**整段内容**（含 `BEGIN/END` 行） |
| `SSH_PORT` | 可选 | 默认 22 |
| `DEPLOY_PATH` | ✅ | 服务器上的仓库路径，如 `/srv/mywebsite` |
| `SERVICE_NAME` | ✅ | systemd 服务名，如 `mywebsite` |

---

## 2. GitHub OAuth 应用

1. 打开 **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
2. 填写：
   - **Application name**：随意，如 `mywebsite`
   - **Homepage URL**：`https://<用户名>.github.io/<仓库名>/`（或自定义域名）
   - **Authorization callback URL**：`https://api.example.com/accounts/github/login/callback/`
     （必须是**后端域名**，allauth 用它接收授权码）
3. 创建后记录 **Client ID**，并生成 **Client Secret**
4. 把它们写进服务器的环境变量（见下一节），**不要**提交到仓库

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

## 3. 服务器一次性准备

```bash
# 1) 拉代码（首次）
sudo mkdir -p /srv && cd /srv
sudo git clone git@github.com:<用户名>/<仓库名>.git mywebsite
sudo chown -R deploy:www-data /srv/mywebsite

# 2) 建虚拟环境（放在仓库根下，两个工作流都按这个路径找）
cd /srv/mywebsite
python3 -m venv .venv
./.venv/bin/python -m pip install -r backend/requirements-prod.txt

# 3) 生产环境变量（不要写进仓库）
sudo tee /etc/mywebsite.env >/dev/null <<'ENV'
DJANGO_SECRET_KEY=换成随机 50 位字符串
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=api.example.com
FRONTEND_URL=https://<用户名>.github.io/<仓库名>
CORS_ALLOWED_ORIGINS=https://<用户名>.github.io
CSRF_TRUSTED_ORIGINS=https://<用户名>.github.io
GITHUB_CLIENT_ID=你的ClientID
GITHUB_CLIENT_SECRET=你的ClientSecret
ENV
sudo chmod 600 /etc/mywebsite.env

# 4) 首次迁移 + 静态文件
cd /srv/mywebsite/backend
set -a; . /etc/mywebsite.env; set +a
../.venv/bin/python manage.py migrate --noinput
../.venv/bin/python manage.py collectstatic --noinput
../.venv/bin/python manage.py createsuperuser

# 5) 服务与反向代理（用仓库里的样例文件）
sudo cp /srv/mywebsite/deploy/mywebsite.service.sample /etc/systemd/system/mywebsite.service
sudo cp /srv/mywebsite/deploy/nginx.conf.sample /etc/nginx/sites-available/mywebsite
sudo systemctl daemon-reload && sudo systemctl enable --now mywebsite
sudo ln -s /etc/nginx/sites-available/mywebsite /etc/nginx/sites-enabled/ && sudo nginx -s reload

# 6) 允许部署用户免密重启服务（工作流里用到 sudo systemctl restart）
echo "deploy ALL=(ALL) NOPASSWD: /bin/systemctl restart mywebsite, /bin/systemctl status mywebsite, /usr/bin/journalctl -u mywebsite *" \
  | sudo tee /etc/sudoers.d/mywebsite-deploy
sudo chmod 440 /etc/sudoers.d/mywebsite-deploy
```

> `FRONTEND_URL` 用 GitHub Pages 域名时，`CORS_ALLOWED_ORIGINS` 与 `CSRF_TRUSTED_ORIGINS`
> 只填**源**（协议+域名，不带路径），例如 `https://user.github.io`。

---

## 4. 部署触发方式

| 工作流 | 自动触发 | 手动触发 |
| --- | --- | --- |
| `deploy-pages.yml` | `frontend/**` 推送到 `main` | Actions → Deploy frontend → Run workflow |
| `deploy-backend.yml` | `backend/**`、`deploy/**` 推送到 `main` | Actions → Deploy backend → Run workflow |

后端部署失败时，工作流会打印最近 80 行 `journalctl` 日志，并在结尾给出排查顺序。

---

## 5. 关键配置项速查

| 位置 | 配置 | 作用 |
| --- | --- | --- |
| `frontend/vite.config.js` | `VITE_BASE_PATH` | 资源前缀 + Router history base（子路径/自定义域名） |
| `frontend/vite.config.js` | `spaFallback` 插件 | 构建后生成 `404.html`，子路由刷新不再 404 |
| `frontend/src/api/index.js` | `VITE_API_BASE_URL` | 后端接口地址（开发留空走代理） |
| `backend/mywebsite/settings.py` | `CORS_ALLOWED_ORIGINS` | 允许携带 Cookie 的前端源 |
| `backend/mywebsite/settings.py` | `CSRF_TRUSTED_ORIGINS` | 跨站写请求白名单 |
| `backend/mywebsite/settings.py` | `SESSION_COOKIE_SAMESITE=None` 等 | 非 DEBUG 自动切换为跨站 Cookie 策略 |

---

## 6. 常见问题

**Q1. 前端能打开但接口全 502/被拦截？**
先确认 `API_BASE_URL` 变量已设置且没有结尾斜杠，然后检查后端 `CORS_ALLOWED_ORIGINS`
是否**恰好等于**前端源（`https://user.github.io`，不要带仓库路径）。

**Q2. 登录后写操作（评论/上传/收藏）403？**
多数是 CSRF：
- 后端 `CSRF_TRUSTED_ORIGINS` 是否包含前端源
- `DJANGO_DEBUG=False` 时 Cookie 才会切成 `SameSite=None; Secure`，跨站请求才带得上
- 前端 token 来自 `/api/auth/csrf/` 响应体（跨域读不到 Cookie），确认没被缓存成登录前的旧值

**Q3. 子路由刷新 404？**
确认构建产物里有 `404.html`（工作流已校验）；自定义域名时确认 `PAGES_BASE_PATH=/`。

**Q4. 浏览器完全不带 Cookie（如 Safari 阻止第三方 Cookie）？**
把后端放到与前端同域的子域（例如前端 `www.example.com`、后端 `api.example.com`），
或为后端绑定自定义域名，避免跨站 Cookie 限制。

**Q5. 上传大文件失败？**
Nginx `client_max_body_size` 要大于后端 `MATERIAL_MAX_UPLOAD_SIZE`（默认 50MB）。
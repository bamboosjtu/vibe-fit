# 本地 Docker 部署

VibeFit PWA 采用**本地 Docker 一体化部署**：前端、后端、worker、Postgres、Caddy HTTPS 网关全部以容器形式运行在本地，不依赖任何云服务（无 Google OAuth / Pub/Sub / Cloud Logging / Cloud Run）。

> 如需参考历史 GCP 云端部署方案，见 [gcloud.md](./gcloud.md)（仅作参考，本地构建已移除 GCP 依赖）。

## 部署架构

```
手机 / 平板 / 浏览器
    │
    │ HTTPS 443
    ▼
Caddy（tls internal 自签证书）
├── /              → frontend:80（nginx 静态站点）
├── /api/*         → backend:8080（Fastify API）
└── /health        → backend:8080

内部容器网络：
postgres ← backend → worker（HTTP push 事件）
```

同时支持两种部署形态：

| 形态 | 入口 | 内部服务 |
| --- | --- | --- |
| 家庭局域网（默认） | Caddy HTTPS（`tls internal` 自签 CA） | frontend / backend / worker / postgres |
| 未来云部署 | 公网负载均衡或反向代理（ALB / SLB / Nginx / Caddy） | frontend / backend / worker / postgres / 云消息服务 |

Frontend 与 Backend 路由结构在两种形态下保持不变。

## 前置要求

- Docker Desktop（含 Docker Compose v2、buildx）
- 端口 `80`（Caddy HTTP）、`443`（Caddy HTTPS）、`8081`（前端直连）、`8080`（后端直连）、`5432`（Postgres）未被占用
- 一个 163 邮箱账号（用于发送登录验证码）

## 部署文件

部署文件位于 `pwa/`：

```
pwa/
├── docker-compose.yml       # 编排：postgres + backend + worker + frontend + caddy
├── Caddyfile                # Caddy HTTPS 网关配置
├── backend/
│   ├── Dockerfile           # 多阶段多目标构建（api-runtime / worker-runtime）
│   ├── docker-entrypoint.sh # backend 启动时用 psql 初始化 schema（v1）
│   └── .env.example         # 后端配置模板
├── frontend/
│   ├── Dockerfile           # 前端构建（Vite）+ nginx 静态服务
│   └── nginx.conf           # nginx 反向代理 /api/* → backend（同源访问）
├── scripts/
│   └── acceptance.sh        # 部署验收脚本
├── build-multiarch.sh       # 多架构（AMD64 + ARM64）构建脚本
└── cloudbuild.backend.yaml  # Cloud Build 配置（独立 backend/worker 镜像，可选）
```

## 服务说明

| 服务 | 作用 | 端口（宿主:容器） | 说明 |
| --- | --- | --- | --- |
| `postgres` | PostgreSQL 15 数据库 | 5432:5432 | 数据持久化到命名卷 `vibe_fit_pg_data` |
| `backend` | Fastify API | 8080:8080 | 镜像构建目标 `api-runtime`；启动时通过 `docker-entrypoint.sh` 用 `psql` 执行 `migration.sql` 初始化 schema（固定为版本 1，幂等）；邮箱验证码登录 + postgres 数据；通过 HTTP push 把事件推给 worker |
| `worker` | 事件处理 worker | - | 镜像构建目标 `worker-runtime`；接收 backend 推送的 `backup.created` 事件并记录日志；**不含 Prisma Client / 数据库依赖** |
| `frontend` | nginx 静态站点 | 8081:80 | nginx 反向代理 `/api/*` 与 `/health` 到 backend，支持同源访问 |
| `caddy` | HTTPS 网关 | 80:80, 443:443 | 家庭局域网 HTTPS 入口；`tls internal` 自动生成本地 CA 证书；按路径分流到 frontend / backend |

### 启动顺序

```
postgres（健康检查通过）
  ↓
backend（entrypoint 脚本用 psql 初始化 schema v1 → 启动 server）
  ↓
worker + frontend
  ↓
caddy
```

> 数据库 schema 固定为版本 1，由 backend 容器的 `docker-entrypoint.sh` 脚本在启动时用 `psql -f migration.sql` 初始化。脚本检测 `users` 表是否存在，已初始化的数据库会跳过。**不使用 prisma migrate，不使用独立迁移服务，生产镜像不含 prisma CLI。**

## 镜像构建

### 多阶段多目标 Dockerfile

`backend/Dockerfile` 采用多阶段构建，解决镜像分层膨胀并隔离 backend / worker 构建产物：

| 阶段 | 职责 |
| --- | --- |
| `base` | node:20-alpine 基础镜像 |
| `dependencies` | `npm ci` 安装完整依赖（含 devDependencies），仅供编译 |
| `builder` | 复制 src/prisma，执行 `prisma generate` 与 `tsc`，产出 `dist/` 与 Prisma Client |
| `production-dependencies` | `npm ci --omit=dev --omit=optional --ignore-scripts`，干净安装生产依赖，**不含 prisma CLI** |
| `api-runtime` | 仅复制 `dist/server.js` + 生产依赖 + Prisma Client runtime + psql；`USER node` |
| `worker-runtime` | 仅复制 `dist/worker.js` + `dist/config` + 生产依赖；`CMD ["node", "dist/worker.js"]`；**不含 Prisma Client** |

关键约束：

- 最终运行镜像**不执行完整 `npm ci`**，不依靠"先装后删"缩减体积
- 最终运行镜像**不含** TypeScript、ESLint、tsx、Prisma CLI 等开发依赖
- Prisma Client 只在 `builder` 阶段生成，复制到 `api-runtime`
- `production-dependencies` 阶段构建时验证 `! test -f node_modules/.bin/prisma`
- 保持 `USER node`，`NODE_ENV=production`，清除 npm cache

### 本地构建（单架构）

```bash
cd pwa
docker compose build backend worker
```

`docker-compose.yml` 已为 backend / worker 指定 `build.target`，自动构建对应目标。

### 多架构构建（AMD64 + ARM64）

用于将镜像推送到局域网仓库供 ARM 设备（如树莓派、ARM 服务器）拉取：

```bash
# 前提：创建 buildx builder
docker buildx create --use --name multiarch --driver docker-container
docker buildx inspect --bootstrap

# 构建并推送双架构镜像
cd pwa
DOCKER_REGISTRY=your-registry:5000 TAG=v1 ./build-multiarch.sh

# 或单独构建
DOCKER_REGISTRY=your-registry:5000 TAG=v1 ./build-multiarch.sh backend
DOCKER_REGISTRY=your-registry:5000 TAG=v1 ./build-multiarch.sh worker
```

> 本地 Docker 部署使用 `docker compose`（自动匹配宿主架构），无需多架构构建。

## 部署步骤

### 1. 配置 163 邮箱 SMTP

本地部署使用**邮箱验证码登录**（无密码），后端通过 163 邮箱 SMTP 发送验证码。部署前必须先获取 163 邮箱授权码：

1. 登录 [163 邮箱网页版](https://mail.163.com)。
2. 进入「设置 → POP3/SMTP/IMAP」，开启 **SMTP 服务**（如已开启可跳过）。
3. 按提示用手机发送短信获取**授权码**（这是一串独立字符串，**不是邮箱登录密码**）。
4. 记下授权码。

> 163 SMTP 服务器：`smtp.163.com`，SSL 端口 `465`。发件地址即你的 163 邮箱地址。

### 2. 填写 SMTP 配置

编辑 `pwa/backend/.env`（由 `.env.example` 复制而来），填入 163 邮箱凭据。`docker-compose.yml` 的 `backend` 服务通过 `env_file: ./backend/.env` 自动加载这些配置：

```env
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_USER=your_email@163.com        # 你的 163 邮箱地址
SMTP_PASS=你的163邮箱授权码           # 第 1 步获取的授权码（不是登录密码）
SMTP_FROM=your_email@163.com         # 可选，默认用 SMTP_USER
```

> `docker-compose.yml` 的 `environment` 段只保留容器网络相关变量（`DATABASE_URL`、`WORKER_PUSH_URL`、`CORS_ORIGIN` 等），会覆盖 `.env` 中的同名项；SMTP 等配置由 `.env` 提供。

### 3. 启动

在 `pwa/` 目录下执行：

```bash
cd pwa
docker compose up -d --build
```

首次启动会依次：构建镜像 → 启动 postgres → 健康检查通过 → 启动 backend（entrypoint 脚本用 psql 初始化 schema → 启动 server）→ 启动 worker + frontend → 启动 caddy。

### 4. 访问

推荐通过 Caddy HTTPS 网关访问（家庭局域网）：

- **前端**：https://localhost
- **后端健康检查**：https://localhost/health
- **后端版本**：https://localhost/api/version

> Caddy 使用 `tls internal` 自动生成本地 CA 证书。浏览器首次访问会提示证书不受信任，需手动信任或继续访问。`curl` 测试加 `-k` 跳过验证。

也可直连容器端口（绕过 Caddy）：

- 前端：http://localhost:8081
- 后端：http://localhost:8080/health

### 5. 验收

运行验收脚本，检查容器状态、服务健康、HTTPS 网关、同源代理、镜像隔离等：

```bash
cd pwa
./scripts/acceptance.sh
```

预期输出 `✅ 全部验收通过`，共 18 项检查。详见下方[验收脚本](#验收脚本)章节。

## 默认配置（本地）

| 项 | 值 |
| --- | --- |
| `AUTH_MODE` | `email`（邮箱验证码登录） |
| `DATA_MODE` | `postgres` |
| `EVENT_PUBLISHER` | `local`（HTTP push 到 worker） |
| Postgres 账号 | `vibefit` / `vibefit_dev_password` / `vibefit_dev` |
| `JWT_SECRET` | `dev-only-secret`（仅本地，生产请改） |
| `CORS_ORIGIN` | 含 `https://localhost`、`https://127.0.0.1`、`http://localhost:8081` 等 |
| 验证码有效期 | 300 秒（5 分钟） |
| 验证码长度 | 6 位数字 |

> 登录流程：前端输入邮箱 → 后端生成 6 位验证码并通过 163 SMTP 发送 → 用户填入验证码 → 后端校验通过后签发 JWT，自动完成登录/注册。

## 同源访问

前端 nginx 与 Caddy 均反向代理 `/api/*` 到 backend，实现同源访问，避免 CORS 问题：

- **Caddy 模式**（推荐）：浏览器访问 `https://localhost`，Caddy 按 path 分流
- **直连前端模式**：浏览器访问 `http://localhost:8081`，nginx 代理 `/api/*` → `backend:8080`

前端构建时不设置 `VITE_API_BASE_URL`，使用相对路径（如 `/api/auth/send-code`），由入口层（Caddy 或 nginx）转发到 backend。

## 验收脚本

`pwa/scripts/acceptance.sh` 检查以下项目：

| # | 检查项 | 说明 |
| --- | --- | --- |
| 1 | 容器状态 | 5 个容器全部 running（postgres / backend / worker / frontend / caddy） |
| 2 | 后端健康检查 | `GET /health` 返回 `{"status":"ok"}` |
| 3 | 后端版本信息 | `GET /api/version` 返回 `authMode=email` |
| 4 | 前端直连访问 | `GET http://localhost:8081/` → 200 |
| 5 | Caddy HTTPS 网关 | `GET https://localhost/` → 200；`GET https://localhost/health` → ok |
| 6 | 同源 API 访问 | 通过前端 nginx 代理访问 `/health` 与 `/api/version` |
| 7 | Worker 运行状态 | Worker 日志含 "Worker listening" |
| 8 | 镜像隔离验证 | Worker 不含 Prisma Client；Backend 含 Prisma Client；两者均不含 Prisma CLI |
| 9 | Schema 初始化 | Backend 日志含 "Schema initialized" 或 "Schema already exists" |

运行方式（Windows 需 Git Bash 或 WSL）：

```bash
cd pwa
./scripts/acceptance.sh
```

## 常用命令

```bash
# 查看日志
docker compose logs -f backend
docker compose logs -f worker
docker compose logs -f frontend
docker compose logs -f caddy

# 停止
docker compose down

# 停止并清除数据卷（重置数据库）
docker compose down -v

# 仅重新构建 backend（独立镜像）
docker compose build backend && docker compose up -d backend

# 仅重新构建 worker（独立镜像）
docker compose build worker && docker compose up -d worker

# 重新生成 Caddy 自签证书（清空证书卷）
docker compose stop caddy && docker compose rm -f caddy
docker volume rm pwa_caddy_data pwa_caddy_config
docker compose up -d caddy
```

## 验证 worker 事件链路

登录后在设置页点击「备份到云端」，backend 写入备份后会通过 HTTP push 把 `backup.created` 事件推给 worker。查看 worker 日志应能看到：

```bash
docker compose logs worker | grep "Processed backup.created event"
```

## 测试模式（mock）

Mock 模式**仅用于测试**，不发送邮件、不连数据库、不推送事件。测试时单独启动：

```bash
# 后端测试模式（需单独跑，不影响本地部署）
cd pwa/backend
AUTH_MODE=mock DATA_MODE=mock EVENT_PUBLISHER=mock NODE_ENV=test npm run dev
```

mock 模式下 `POST /api/auth/send-code` 会把验证码直接放在响应的 `devCode` 字段返回（不发邮件），便于测试读取。

## 云部署（可选）

### Cloud Build 独立镜像

`pwa/cloudbuild.backend.yaml` 配置 Cloud Build 构建并部署两个独立镜像到 Cloud Run：

- `vibe-fit-backend:$BUILD_ID`（`api-runtime` target）
- `vibe-fit-worker:$BUILD_ID`（`worker-runtime` target）

两个镜像分别推送、分别标记（`$BUILD_ID` 与 `$_COMMIT_SHA`）、分别部署、分别回滚。Worker 部署不再通过 `--command` / `--args` 覆盖 backend 镜像。

```bash
gcloud builds submit --config=cloudbuild.backend.yaml \
  --substitutions=_REGION=asia-east1,_REPO=vibe-fit,_COMMIT_SHA=$(git rev-parse HEAD) \
  pwa/
```

> 详细步骤见 [gcloud.md](./gcloud.md)（历史参考，恢复 GCP 方案需重新引入已移除的依赖）。

## 故障排查

### 验证码邮件发送失败

1. 确认 `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS` 已正确填写。
2. 确认 `SMTP_PASS` 是**授权码**而非邮箱登录密码。
3. 确认 163 邮箱已开启 SMTP 服务。
4. 查看后端日志：`docker compose logs backend | grep "Failed to send verification email"`。

### Caddy HTTPS 访问失败（curl 返回 000）

1. 确认 Caddyfile 中站点地址显式声明了 `https://localhost, https://127.0.0.1`（不能只用 `:443`，否则 Caddy 不知道为哪个主机名签发证书）。
2. 确认 Caddy 容器在运行：`docker compose ps caddy`。
3. 查看 Caddy 日志：`docker compose logs caddy`。
4. 如证书损坏，清空证书卷重新生成（见常用命令）。
5. `curl` 测试加 `-k` 跳过证书验证；浏览器访问需手动信任本地 CA。

### 端口被占用

修改 `pwa/docker-compose.yml` 中对应服务的端口映射。Caddy 默认占用 80/443，如被占用可改为其他端口（但浏览器访问需带端口）。

### 前端无法访问后端

1. 确认 `docker-compose.yml` 中 `frontend` 的构建参数未设置 `VITE_API_BASE_URL`（使用同源相对路径）。
2. 确认 `frontend/nginx.conf` 反向代理 `/api/` → `backend:8080`。
3. 确认 backend 容器健康：`curl http://localhost:8080/health`。
4. 通过 Caddy 访问时，确认 Caddyfile 中 `@api path /api/* /health` 路由正确。

### 镜像含 Prisma CLI（构建验证失败）

`production-dependencies` 阶段构建时会验证 `! test -f node_modules/.bin/prisma`。如失败：

1. 确认 `backend/package.json` 中 `prisma` 在 `devDependencies` 而非 `dependencies`。
2. 确认 Dockerfile 中 `npm ci --omit=dev --omit=optional --ignore-scripts`（三个参数缺一不可：`--omit=dev` 跳过 devDependencies；`--omit=optional` 跳过 @prisma/client 的可选 peer dep prisma CLI；`--ignore-scripts` 跳过 postinstall）。

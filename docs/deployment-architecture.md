# 部署架构

VibeFit 拆为 PWA（纯前端）和 Backend（备份服务）两个独立可部署单元。两者可单独部署、单独扩缩容、单独升级。Android 通过 Capacitor 打包 PWA 构建产物，不参与服务端部署。

## 顶层目录与服务映射

| 目录 | 构建产物 | 部署单元 |
| --- | --- | --- |
| `pwa/` | nginx 静态镜像（`vibefit-frontend`） | 独立容器，不依赖 backend |
| `backend/` | Fastify API 镜像（`vibefit-backend`）+ Worker 镜像（`vibefit-worker`） | 独立容器栈（postgres + backend + worker） |
| `android/` | APK / AAB | 移动端安装包，不部署到服务器 |
| `docs/` | — | 文档，不部署 |

## PWA 部署

PWA 是纯前端 nginx 镜像，离线优先，不依赖 backend 容器。

```text
用户浏览器
  ↓
nginx :8081（Docker）
  ├── 静态资源（HTML/CSS/JS/图标）
  ├── Service Worker（vite-plugin-pwa 生成，缓存预缓存条目）
  └── /api/* 反代到 upstream backend（可选，未启动则仅云端备份失败）
```

### 本地 Docker

```bash
cd pwa
docker compose up -d --build    # 仅 frontend 容器
```

### 镜像构建

```bash
cd pwa
docker buildx bake --file docker-bake.hcl    # 产出 vibefit-frontend
```

多架构（linux/amd64 + linux/arm64），构建期注入 `VITE_API_BASE_URL`、`VITE_AUTH_MODE` 等参数。

### 发布

```bash
cd pwa
sh scripts/publish-acr.sh    # 推送到阿里云 ACR
```

## Backend 部署

Backend 是三服务容器栈：postgres + backend + worker。

```text
Caddy :80/:443（可选，HTTPS 终止 + 反代）
  ├── /api/* /health* /readyz → Backend :8080
  └── /                       → Frontend :80（可选，同栈部署时）

Backend :8080（Fastify API）
  └── PostgreSQL :5432

Worker（Fastify，独立进程）
  ← POST /pubsub/backups（Backend HTTP push 模拟 Pub/Sub）
  └── PostgreSQL :5432（清理过期 backup_snapshots）
```

数据库 schema 初始化走 postgres 镜像 `/docker-entrypoint-initdb.d/` 自动机制：`prisma/init.sql` 挂载为只读 init 脚本，仅在数据卷首次创建时执行。**不再提供自动化 migrate 服务**；生产首次部署由运维直接 `psql $DATABASE_URL -f prisma/init.sql`。

### 本地 Docker

```bash
cd backend
cp .env.example .env    # 设置 JWT_SECRET + SMTP 参数
docker compose up -d --build --wait
docker compose ps --all # postgres/backend/worker 均 running/healthy
sh scripts/acceptance.sh
```

### 镜像构建

```bash
cd backend
docker buildx bake --file docker-bake.hcl
```

产出 2 个镜像（多架构 linux/amd64 + linux/arm64）：

| 镜像 | Dockerfile target | 用途 |
| --- | --- | --- |
| `vibefit-backend` | `api-runtime` | API 服务，CMD `node dist/server.js` |
| `vibefit-worker` | `worker-runtime` | Worker 服务，CMD `node dist/worker.js` |

运行时镜像不含 TypeScript / ESLint / tsx / Prisma CLI / psql 与源/测试文件。镜像 tag 含 Git commit SHA 和 Build ID，不使用纯 `latest`。

### 发布

```bash
cd backend
sh scripts/publish-acr.sh    # 推送 2 个镜像到阿里云 ACR，写入 images.lock.env
```

## 生产部署

生产部署不在仓库内提供专用 compose 或运维脚本。通用做法：

- 用 [scripts/publish-acr.sh](../backend/scripts/publish-acr.sh) 发布镜像，得到 `backend/scripts/images.lock.env`（含 `sha256:` digest）
- 运维在自己环境创建 `docker-compose.override.yml` 引用具体 digest，配置 secrets 与 HTTPS 网关
- 运维直接 `psql $DATABASE_URL -f prisma/init.sql` 初始化 schema
- 备份/巡检由运维用自己工具链（restic / systemd / 云厂商方案）承担

仓库刻意不为某种部署目标（树莓派、K8s、云主机）维护专用目录，避免出现「特殊打包专用目录或文件」。

## GCP 可选部署

Backend 支持可选的 GCP Cloud Run 部署：

- [`backend/cloudbuild.publish.yaml`](../backend/cloudbuild.publish.yaml) — 镜像构建与推送
- [`backend/cloudbuild.deploy-gcp.yaml`](../backend/cloudbuild.deploy-gcp.yaml) — Cloud Run 部署
- [`backend/docs/gcloud.md`](../backend/docs/gcloud.md) — 操作指南

## 跨端共享约束

- **CORS**：`CORS_ORIGIN` 必须同时放行 `localhost` 和 `127.0.0.1` 变体，避免来源不匹配
- **HTTPS**：终止在独立网关层（Caddy），内部服务走 Docker 网络
- **trustProxy**：Fastify 配置 `trustProxy`，保证通过代理后协议和客户端地址准确
- **Service Worker**：`autoUpdate` + `skipWaiting: true` + `clientsClaim: true`，防止缓存旧 JS bundle
- **反代端点**：Caddy/nginx 必须包含 `/healthz` 和 `/readyz` 端点，除 `/api/*` 和 `/health`

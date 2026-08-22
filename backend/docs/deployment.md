# 本机 Docker 部署

本文件描述后端开发机上的容器栈（postgres + backend + worker）。前端 H5 单独部署在 `pwa/`，需要联调时另起 `pwa/docker-compose.yml`。不要把本机 Compose 的开发密码、宿主端口复制到生产环境。

## 架构

后端已从 `pwa/` 抽离为顶层 `backend/` 目录，独立镜像与 compose，作为 PWA 与 Android 的共同云端备份服务。本机开发栈仅包含 backend 自有服务：

```text
backend/docker-compose.yml
  ├─ postgres  : PostgreSQL 15（数据卷，首次启动自动执行 prisma/init.sql）
  ├─ backend   : Fastify API（:8080）
  └─ worker    : 备份事件 worker（接收 HTTP push）

pwa/docker-compose.yml
  └─ frontend  : nginx + 构建产物 + Service Worker（:8081，独立部署）
```

依赖链：`PostgreSQL healthy → Worker healthy → Backend healthy`。

数据库 schema 初始化走 PostgreSQL 镜像标准 `/docker-entrypoint-initdb.d/` 机制：[prisma/init.sql](../prisma/init.sql) 挂载为只读 init 脚本，**仅在数据卷首次创建时执行**，后续重启不会重复跑。生产部署由运维直接连接 PostgreSQL 执行同一份 `init.sql`，不依赖容器自动化。

Worker 连接 PostgreSQL，并在成功消费 `backup.created` 后执行「超过 90 天删除、每用户至少保留最新 10 份」的幂等清理。

本机环境为方便联调保留以下端口和开发凭据：

| 服务 | 地址 |
| --- | --- |
| Backend API | `http://localhost:8080` |
| PostgreSQL | `localhost:5432`，开发密码见 Compose |
| Frontend（独立部署） | `http://localhost:8081`（在 `pwa/` 启动） |

## 启动

先从 `backend/.env.example` 创建 `backend/.env`，设置至少 32 字符的 `JWT_SECRET` 与 SMTP 参数，然后执行：

```bash
cd backend
docker compose up --detach --build --wait
docker compose ps --all
```

三个长期服务均应为 `running/healthy`。

仅当需要联调前端时，另起前端容器：

```bash
cd pwa
docker compose up --detach --build
# http://localhost:8081
```

PWA 是纯前端离线应用，不依赖 backend 容器即可完整运行；前端 nginx 通过同源 `/api/*` 反代到 upstream `backend`（同 Docker 网络时生效），未启动 backend 时仅云端备份失败。

## 数据库初始化

`prisma/init.sql` 全部使用 `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`，幂等安全。

| 场景 | 执行方式 |
| --- | --- |
| 本地首次启动 | postgres 容器自动执行挂载到 `/docker-entrypoint-initdb.d/init.sql` 的 init 脚本 |
| 本地 schema 变更后 | `docker compose down -v` 删卷重建（仅本地开发，会丢数据） |
| 生产首次部署 | 运维 `psql $DATABASE_URL -f prisma/init.sql` |
| 生产 schema 变更 | 运维编写增量 SQL，review 后手动执行 |

后端运行时镜像 **不含 psql、不含 prisma CLI、不含 migrate 入口**，所有 schema 操作都在容器外完成。

## 验收

Windows 使用 Git Bash 或 WSL：

```bash
cd backend
sh scripts/acceptance.sh
```

脚本检查：长期服务状态（postgres/backend/worker）、Backend/Worker 健康、版本接口、Backend/Worker 镜像都具备 Prisma Client 但不包含 Prisma CLI。

前端验收由 `pwa/scripts/acceptance.sh` 负责，独立运行。

本机开发栈不启用 TLS；如需本地 HTTPS 联调，使用 `vite` 的自签证书或单独部署 Caddy。任何环境都不以 `curl -k` 绕过 TLS。

## 常用命令

```bash
cd backend
docker compose logs --follow backend worker
docker compose restart backend worker
docker compose down
```

删除 `vibe_fit_pg_data` 会永久清除本机数据库，普通重启或升级不要使用 `docker compose down -v`。

## 发布镜像

多架构发布（linux/amd64 + linux/arm64）入口：

```bash
# 后端：发布 vibefit-backend + vibefit-worker，写入 backend/scripts/images.lock.env
cd backend
ACR_REGISTRY=crpi-xxx.personal.cr.aliyuncs.com \
ACR_NAMESPACE=vibefit \
RELEASE_VERSION=1.1.0 \
./scripts/publish-acr.sh

# 前端：发布 vibefit-frontend，写入 pwa/scripts/images.lock.env
cd pwa
ACR_REGISTRY=crpi-xxx.personal.cr.aliyuncs.com \
ACR_NAMESPACE=vibefit \
RELEASE_VERSION=1.1.0 \
./scripts/publish-acr.sh
```

前后端独立发布、独立锁文件。锁文件记录 `sha256:` digest，生产部署通过 docker-compose override 引用具体 digest，不接受 `latest` tag。

GCP 可选云端发布见 [gcloud.md](./gcloud.md)。

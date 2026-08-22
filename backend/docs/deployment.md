# 本机 Docker 部署

本文件描述后端开发机上的容器栈（postgres + migrate + backend + worker）。前端 H5 单独部署在 `pwa/`，需要联调时另起 `pwa/docker-compose.yml`；树莓派生产部署使用不可变 ACR 镜像、私有 CA 证书和宿主机 secret，见 [树莓派部署与运维手册](./raspberry-pi.md)。不要把本机 Compose 的开发密码、宿主端口复制到生产环境。

## 架构

后端已从 `pwa/` 抽离为顶层 `backend/` 目录，独立镜像与 compose，作为 PWA 与 Android 的共同云端备份服务。本机开发栈不再包含 Caddy 与 Frontend：

```text
backend/docker-compose.yml
  ├─ postgres  : PostgreSQL 15（数据卷）
  ├─ migrate   : 一次性 schema 迁移（psql 执行 prisma/migrations）
  ├─ backend   : Fastify API（:8080）
  └─ worker    : 备份事件 worker（接收 HTTP push）

pwa/docker-compose.yml
  └─ frontend  : nginx + 构建产物 + Service Worker（:8081，独立部署）

backend/deploy/rpi/compose.yaml
  └─ Caddy + Backend + Worker + Postgres + Frontend（生产一体化，见 raspberry-pi.md）
```

依赖链：`PostgreSQL healthy → migrate exited 0 → Worker healthy → Backend healthy`。

数据库迁移不再由 Backend 每次重启自动执行；Worker 连接 PostgreSQL，并在成功消费 `backup.created` 后执行「超过 90 天删除、每用户至少保留最新 10 份」的幂等清理。

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

`migrate` 应显示 `Exited (0)`，其余三个长期服务应为 `running/healthy`。

仅当需要联调前端时，另起前端容器：

```bash
cd pwa
docker compose up --detach --build
# http://localhost:8081
```

PWA 是纯前端离线应用，不依赖 backend 容器即可完整运行；前端 nginx 通过同源 `/api/*` 反代到 upstream `backend`（同 Docker 网络时生效），未启动 backend 时仅云端备份失败。

## 验收

Windows 使用 Git Bash 或 WSL：

```bash
cd backend
sh scripts/acceptance.sh
```

脚本检查：长期服务状态（postgres/backend/worker）、一次性迁移退出码、Backend/Worker 健康、版本接口、Backend/Worker 镜像都具备 Prisma Client 但不包含 Prisma CLI。

前端验收由 `pwa/scripts/acceptance.sh` 负责，独立运行。

本机开发栈不启用 TLS；如需本地 HTTPS 联调，使用 `vite` 的自签证书或单独部署 Caddy。树莓派生产验收使用用户提供的私有根 CA，任何环境都不以 `curl -k` 绕过 TLS。

## 常用命令

```bash
cd backend
docker compose logs --follow backend worker
docker compose logs migrate
docker compose restart backend worker
docker compose down
```

删除 `vibe_fit_pg_data` 会永久清除本机数据库，普通重启或升级不要使用 `docker compose down -v`。

## 发布 ARM64 镜像

多架构发布、摘要锁文件与 ACR 登录流程见 [树莓派部署与运维手册](./raspberry-pi.md#发布到阿里云-acr)。发布入口为 `backend/scripts/publish-acr.sh`（后端镜像：vibefit-backend / vibefit-worker / vibefit-maintenance / vibefit-postgres / vibefit-caddy）与 `pwa/scripts/publish-acr.sh`（前端镜像：vibefit-frontend），生产 Compose 不含 `build:`，也不接受 `latest`。

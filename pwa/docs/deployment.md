# 本机 Docker 部署

本文件只描述开发机上的一体化环境。树莓派生产部署使用不可变 ACR 镜像、私有 CA 证书和宿主机 secret，见 [树莓派部署与运维手册](./raspberry-pi.md)。不要把本机 Compose 的开发密码、宿主端口或 Caddy 内部 CA 复制到生产环境。

## 架构

```text
Caddy :80/:443
  ├─ /api/* /health* /readyz -> Backend :8080
  └─ /                         -> Frontend :80

Backend -> Worker -> PostgreSQL 15
              ↑
       backup.created 清理事件

PostgreSQL healthy -> migrate exited 0 -> Worker healthy -> Backend healthy
```

`docker-compose.yml` 包含六个服务：`postgres`、一次性的 `migrate`、`worker`、`backend`、`frontend`、`caddy`。数据库迁移不再由 Backend 每次重启自动执行；Worker 连接 PostgreSQL，并在成功消费 `backup.created` 后执行“超过 90 天删除、每用户至少保留最新 10 份”的幂等清理。

本机环境为方便联调保留以下端口和开发凭据：

| 服务 | 地址 |
| --- | --- |
| Caddy | `https://localhost` |
| Frontend 直连 | `http://localhost:8081` |
| Backend 直连 | `http://localhost:8080` |
| PostgreSQL | `localhost:5432`，开发密码见 Compose |

## 启动

先从 `backend/.env.example` 创建 `backend/.env`，设置至少 32 字符的 `JWT_SECRET` 与 SMTP 参数，然后执行：

```bash
cd pwa
docker compose up --detach --build --wait
docker compose ps --all
```

`migrate` 应显示 `Exited (0)`，其余五个长期服务应为 `running/healthy`。

## 验收

Windows 使用 Git Bash 或 WSL：

```bash
cd pwa
sh scripts/acceptance.sh
```

脚本检查：长期服务状态、一次性迁移退出码、Backend/Worker 健康、版本接口、Frontend/Caddy 路由，以及 Backend/Worker 镜像都具备 Prisma Client 但不包含 Prisma CLI。

本机 Caddy 使用 `tls internal`；验收脚本会从 Caddy 数据卷读取本地根 CA 后执行证书验证。树莓派生产验收使用用户提供的私有根 CA，任何环境都不以 `curl -k` 绕过 TLS。

## 常用命令

```bash
docker compose logs --follow backend worker
docker compose logs migrate
docker compose restart backend worker
docker compose down
```

删除 `vibe_fit_pg_data` 会永久清除本机数据库，普通重启或升级不要使用 `docker compose down -v`。

## 发布 ARM64 镜像

多架构发布、摘要锁文件与 ACR 登录流程见 [树莓派部署与运维手册](./raspberry-pi.md#发布到阿里云-acr)。发布入口为 `scripts/publish-acr.sh`，生产 Compose 不含 `build:`，也不接受标签或 `latest`。

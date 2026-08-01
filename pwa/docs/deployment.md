# 本地 Docker 部署

VibeFit PWA 采用**本地 Docker 一体化部署**：前端、后端、worker、Postgres 全部以容器形式运行在本地，不依赖任何云服务（无 Google OAuth / Pub/Sub / Cloud Logging / Cloud Run）。

> 如需参考历史 GCP 云端部署方案，见 [gcloud.md](./gcloud.md)（仅作参考，本地构建已移除 GCP 依赖）。

## 前置要求

- Docker Desktop（含 Docker Compose v2）
- 端口 `8081`（前端）、`8080`（后端）、`5432`（Postgres）未被占用
- 一个 163 邮箱账号（用于发送登录验证码）

## 部署文件

部署文件位于 `pwa/`：

```
pwa/
├── docker-compose.yml      # 编排：postgres + migrate + backend + worker + frontend
├── frontend/Dockerfile     # 前端构建（Vite）+ nginx 静态服务
└── backend/Dockerfile      # 后端构建（tsc）+ node 运行（backend 与 worker 共用镜像）
```

## 服务说明

| 服务 | 作用 | 端口（宿主:容器） | 说明 |
| --- | --- | --- | --- |
| `postgres` | PostgreSQL 15 数据库 | 5432:5432 | 数据持久化到命名卷 `vibe_fit_pg_data` |
| `migrate` | 一次性数据库迁移 | - | 执行 `prisma migrate deploy`，完成后退出 |
| `backend` | Fastify API | 8080:8080 | 邮箱验证码登录 + postgres 数据；通过 HTTP push 把事件推给 worker |
| `worker` | 事件处理 worker | - | 接收 backend 推送的 `backup.created` 事件并记录日志 |
| `frontend` | nginx 静态站点 | 8081:80 | 构建期注入 `VITE_API_BASE_URL` 指向后端 |

### 启动顺序

```
postgres（健康检查通过）
  ↓
migrate（执行 prisma migrate deploy，完成后退出）
  ↓
backend + worker（依赖 migrate 成功完成）
  ↓
frontend（依赖 backend）
```

## 部署步骤

### 1. 配置 163 邮箱 SMTP

本地部署使用**邮箱验证码登录**（无密码），后端通过 163 邮箱 SMTP 发送验证码。部署前必须先获取 163 邮箱授权码：

1. 登录 [163 邮箱网页版](https://mail.163.com)。
2. 进入「设置 → POP3/SMTP/IMAP」，开启 **SMTP 服务**（如已开启可跳过）。
3. 按提示用手机发送短信获取**授权码**（这是一串独立字符串，**不是邮箱登录密码**）。
4. 记下授权码。

> 163 SMTP 服务器：`smtp.163.com`，SSL 端口 `465`。发件地址即你的 163 邮箱地址。

### 2. 填写 SMTP 配置

编辑 `pwa/docker-compose.yml`，在 `backend` 服务的 `environment` 段填入：

```yaml
  backend:
    environment:
      # ... 其他配置 ...
      SMTP_HOST: "smtp.163.com"
      SMTP_PORT: "465"
      SMTP_USER: "your_email@163.com"        # 你的 163 邮箱地址
      SMTP_PASS: "你的163邮箱授权码"           # 第 1 步获取的授权码
      SMTP_FROM: "your_email@163.com"         # 可选，默认用 SMTP_USER
```

> 也可不改 `docker-compose.yml`，而是把对应值写入 `pwa/backend/.env`（本地开发用）。但 Docker 部署以 `docker-compose.yml` 的 `environment` 为准。

### 3. 启动

在 `pwa/` 目录下执行：

```bash
cd pwa
docker compose up -d --build
```

首次启动会依次：构建镜像 → 启动 postgres → 健康检查通过 → 执行迁移 → 启动 backend + worker → 启动 frontend。

### 4. 访问

- 前端：http://localhost:8081
- 后端健康检查：http://localhost:8080/health
- 后端版本：http://localhost:8080/api/version（`authMode=email`，`dataMode=postgres`）

## 默认配置（本地）

| 项 | 值 |
| --- | --- |
| `AUTH_MODE` | `email`（邮箱验证码登录） |
| `DATA_MODE` | `postgres` |
| `EVENT_PUBLISHER` | `local`（HTTP push 到 worker） |
| Postgres 账号 | `vibefit` / `vibefit_dev_password` / `vibefit_dev` |
| `JWT_SECRET` | `dev-only-secret`（仅本地，生产请改） |
| 验证码有效期 | 300 秒（5 分钟） |
| 验证码长度 | 6 位数字 |

> 登录流程：前端输入邮箱 → 后端生成 6 位验证码并通过 163 SMTP 发送 → 用户填入验证码 → 后端校验通过后签发 JWT，自动完成登录/注册。

## 常用命令

```bash
# 查看日志
docker compose logs -f backend
docker compose logs -f worker
docker compose logs -f frontend

# 停止
docker compose down

# 停止并清除数据卷（重置数据库）
docker compose down -v

# 仅重新构建后端（含 worker，共用镜像）
docker compose build backend && docker compose up -d backend worker

# 手动执行迁移
docker compose run --rm migrate
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

## 故障排查

### 验证码邮件发送失败

1. 确认 `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS` 已正确填写。
2. 确认 `SMTP_PASS` 是**授权码**而非邮箱登录密码。
3. 确认 163 邮箱已开启 SMTP 服务。
4. 查看后端日志：`docker compose logs backend | grep "Failed to send verification email"`。

### 端口被占用

修改 `pwa/docker-compose.yml` 中对应服务的端口映射（如把 `8081:80` 改为 `8082:80`），并同步更新前端构建参数 `VITE_API_BASE_URL`。

### migrate 服务失败

migrate 是一次性服务，失败后不会自动重试。先查看日志：

```bash
docker compose logs migrate
```

修复后执行 `docker compose up -d --build migrate` 重跑，再启动 backend / worker。

### 前端无法访问后端

确认 `docker-compose.yml` 中 `frontend` 的构建参数 `VITE_API_BASE_URL` 指向浏览器可访问的后端地址（本地默认 `http://localhost:8080`）。该值在**构建期**注入，修改后需重新构建 frontend 镜像。

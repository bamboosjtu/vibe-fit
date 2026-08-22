# VibeFit Backend（PWA 与 Android 的共同云端备份服务）

Fastify + TypeScript + Prisma 后端，作为 PWA（`pwa/`）与 Android（`android/`）的可选云端备份服务。后端**平台无关**：API 不区分客户端类型，不写 `if android / if web` 分支；两端通过同一组端点完成全量快照备份/恢复。前端本地数据（IndexedDB / SQLite）始终是唯一可信源，后端只在用户主动触发时参与同步。

跨端共享文档见 [`../docs/`](../docs/)；架构决策见 [`../docs/architecture-decision.md`](../docs/architecture-decision.md)；前端工程见 [`../pwa/`](../pwa/)。

## 目录结构

```
backend/
├── src/
│   ├── routes/                   # 路由（auth.ts / sync.ts / healthz.ts）
│   ├── repositories/             # 仓储层（users / backups / sessions）
│   ├── events/                   # 事件发布（LocalHttpEventPublisher / mock）
│   ├── schemas/                  # zod 输入校验（backup.ts）
│   ├── plugins/                  # Fastify 插件（errorHandler / jwt / cors）
│   ├── config/                   # 环境变量与运行时配置
│   ├── app.ts                    # Fastify 实例与路由注册
│   ├── server.ts                 # API 入口（监听 :8080）
│   └── worker.ts                 # Worker 入口（监听 /pubsub push）
├── prisma/
│   ├── schema.prisma             # 数据模型（User / BackupSnapshot / Session）
│   └── migrations/               # 迁移 SQL（由 migrate 容器执行）
├── tests/                        # 后端测试
├── scripts/                      # 镜像发布与部署验收
├── deploy/
│   └── rpi/                      # 树莓派生产部署套件（compose/scripts/systemd/maintenance）
├── docs/                         # 后端开发与运维文档
│   ├── development.md
│   ├── deployment.md
│   ├── gcloud.md
│   ├── raspberry-pi.md
│   ├── rpi-30-day-validation.md
│   └── 树莓派部署计划.md
├── Dockerfile                    # 多阶段构建（dependencies / builder / api-runtime / worker-runtime）
├── docker-compose.yml            # 本地容器栈（postgres + migrate + backend + worker）
├── docker-bake.hcl               # 多架构构建（backend / worker / maintenance / postgres / caddy）
├── cloudbuild.publish.yaml       # GCP 镜像发布（可选）
├── cloudbuild.deploy-gcp.yaml    # GCP 部署（可选）
├── .env.example                  # 配置模板（JWT / SMTP / DB / CORS / Worker）
└── package.json
```

## API 概览

所有端点平台无关，Android 与 PWA 调用同一组接口。完整契约见 [`docs/development.md`](./docs/development.md)。

| 方法 | 路径 | 认证 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/health` / `/healthz` / `/readyz` | 无 | 存活/就绪探针 |
| `GET` | `/api/version` | 无 | 返回 `APP_VERSION` + `BUILD_NUMBER` |
| `POST` | `/api/auth/send-code` | 无 | 发送邮箱验证码（163 SMTP） |
| `POST` | `/api/auth/verify-code` | 无 | 验证邮箱验证码，签发 JWT |
| `GET` | `/api/me` | JWT | 当前用户信息 |
| `POST` | `/api/backups` | JWT | 推送全量快照（`ExportData` zod schema） |
| `GET` | `/api/backups/latest` | JWT | 拉取最新快照 |
| `POST` | `/pubsub/backups` | 内部 | worker 接收 backup.created push |

## 本地开发

```bash
cd backend
npm install
cp .env.example .env        # 至少设置 32 字符的 JWT_SECRET 与 SMTP 参数
npm run dev                 # API watcher（:8080）
npm run dev:worker          # worker watcher
npm run typecheck
npm run build
```

数据库迁移通过 `migrate` 容器执行，不由 backend 自动跑：

```bash
npm run db:migrate          # Prisma 开发迁移（本机 npm 环境）
```

## Docker 部署

```bash
cd backend
docker compose up -d --build --wait    # postgres + migrate + backend + worker
docker compose ps --all                # migrate 应 Exited(0)，其余 running/healthy
sh scripts/acceptance.sh               # 部署验收
```

启动后访问：http://localhost:8080/health

树莓派生产部署（Caddy + Frontend + Backend + Worker + Postgres 一体化）见 [`docs/raspberry-pi.md`](./docs/raspberry-pi.md)。生产 Compose 通过 `FRONTEND_IMAGE` 引用 `pwa/` 构建发布的前端镜像，不耦合前端构建。

## 镜像构建

```bash
docker buildx bake --file docker-bake.hcl
```

产出 5 个镜像（多架构 linux/amd64 + linux/arm64）：

- `vibefit-backend`（api-runtime target）
- `vibefit-worker`（worker-runtime target，CMD `['node', 'dist/worker.js']`）
- `vibefit-maintenance`（运维脚本镜像）
- `vibefit-postgres`（带初始化 SQL 的 postgres 镜像）
- `vibefit-caddy`（带站点配置的 caddy 镜像）

发布入口 `scripts/publish-acr.sh`；前端镜像由 [`../pwa/scripts/publish-acr.sh`](../pwa/scripts/publish-acr.sh) 单独发布，避免跨端耦合。

## 配置

`backend/.env.example` 是唯一模板，关键字段：

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `JWT_SECRET` | JWT 签名密钥（≥ 32 字符） |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | 163 邮箱 SMTP（发送验证码） |
| `CORS_ORIGIN` | 允许的来源（逗号分隔，同时放行 H5 与 Android WebView） |
| `EVENT_PUBLISHER` | 事件发布实现（`local` / `mock`） |
| `WORKER_URL` | worker 的内部 push 端点 |
| `APP_VERSION` / `BUILD_NUMBER` | 镜像构建期注入的版本信息 |

## 关键约束

- **平台无关**：API 不区分客户端类型；客户端来源仅作为 `deviceId` / `userAgent` 元数据，不影响业务行为。
- **数据契约唯一**：`ExportDataSchema`（定义在 [`../pwa/src/types/index.ts`](../pwa/src/types/index.ts)）是备份 payload 的唯一权威；schema 变更时前后端同步更新。
- **认证统一**：邮箱验证码 + JWT，Android 与 H5 共用同一登录链路；不为 Android 引入单独认证方式。
- **事件可插拔**：当前 `LocalHttpEventPublisher`（HTTP push 模拟 Pub/Sub wire format），未来可扩展 `pubsub`（GCP）。
- **镜像隔离**：`api-runtime` 与 `worker-runtime` 独立 target；运行时镜像不含 TypeScript / ESLint / tsx / Prisma CLI 等开发依赖与源/测试文件。
- **迁移走脚本**：数据库迁移由 `migrate` 容器或 `npm run db:migrate` 脚本执行，**不**打包为独立服务，运行时镜像不含迁移相关代码。

## 关联文档

- 后端开发与 API 契约：[`docs/development.md`](./docs/development.md)
- 本地部署：[`docs/deployment.md`](./docs/deployment.md)
- 树莓派生产部署：[`docs/raspberry-pi.md`](./docs/raspberry-pi.md)
- GCP 可选方案：[`docs/gcloud.md`](./docs/gcloud.md)
- 架构决策（后端独立 + 模块化约束）：[`../docs/architecture-decision.md`](../docs/architecture-decision.md)
- 仓库规范：[`../AGENTS.md`](../AGENTS.md)

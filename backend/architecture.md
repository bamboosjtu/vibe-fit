# VibeFit Backend 架构

## 1. 角色定位

VibeFit 后端是 PWA 与 Android 客户端的**共同云端备份服务**，平台无关（无 `if android/web` 分支）。日常训练读写全部在客户端本地完成，后端仅承担：

- 邮箱验证码登录签发 JWT
- 全量训练快照备份（`POST /api/backups`）
- 最新快照恢复（`GET /api/backups/latest`）
- 备份保留策略（90 天 + 至少 10 份）
- 管理后台（用户与备份查看）

> 决策背景见 [docs/architecture-decision.md](../docs/architecture-decision.md)：将后端从 PWA 内嵌服务拆为独立模块，使 H5/Android 共用同一份云端契约。

## 2. 技术栈

| 层 | 技术 | 版本 | 说明 |
| --- | --- | --- | --- |
| HTTP 框架 | Fastify | ^5.11.3 | API + Worker 共用，双入口 |
| 数据 ORM | Prisma + @prisma/client | ^6.19.3 | 仅 PostgreSQL |
| 数据库 | PostgreSQL | 15 (Alpine) | 本地与生产一致 |
| 鉴权 | @fastify/jwt | ^10.0.0 | HS256 JWT，Bearer header |
| 校验 | zod | ^4.4.3 | 与前端共享数据契约 |
| 邮件 | nodemailer | ^9.0.5 | 163 SMTP 验证码 |
| 运行时 | Node.js | >=24.0.0 <25 | ESM (`"type": "module"`) |
| 构建 | tsc | 5.6+ | 输出到 `dist/` |
| 测试 | node:test（经 tsx） | — | `tests/backend.test.ts` |

## 3. 目录结构

```
backend/
├── src/
│   ├── config/env.ts          # 环境变量加载（支持 *_FILE secrets）
│   ├── db/prisma.ts           # PrismaClient 单例 + 关闭
│   ├── repositories/
│   │   ├── types.ts           # User/Backup/VerificationCode 仓储接口
│   │   ├── postgres.ts        # PostgreSQL 实现
│   │   ├── mock.ts            # 测试用内存实现
│   │   └── index.ts           # DATA_MODE 切换
│   ├── routes/
│   │   ├── healthz.ts        # /healthz /readyz /health
│   │   ├── auth.ts           # /auth/request-code /auth/verify /auth/me
│   │   ├── sync.ts           # /api/backups + /api/backups/latest
│   │   └── admin.ts          # /admin/* 管理后台（HTML SSR）
│   ├── schemas/backup.ts      # BackupPayload zod schema（与 PWA 共享）
│   ├── services/emailService.ts
│   ├── events/
│   │   ├── publisher.ts       # EventPublisher 接口
│   │   ├── types.ts           # BackupCreatedEvent
│   │   ├── localPublisher.ts  # HTTP push 到 worker
│   │   ├── mockPublisher.ts   # 测试用
│   │   └── index.ts           # EVENT_PUBLISHER 切换
│   ├── plugins/errorHandler.ts
│   ├── types/index.ts
│   ├── app.ts                 # API buildServer()
│   ├── workerApp.ts           # Worker buildWorker()
│   ├── server.ts              # API 入口 dist/server.js
│   ├── worker.ts              # Worker 入口 dist/worker.js
│   └── mockDb.ts              # Mock 数据容器
├── prisma/
│   ├── schema.prisma          # 4 个模型：User/EmailVerificationCode/BackupSnapshot/SyncMeta
│   └── init.sql               # 幂等建表 SQL（postgres /docker-entrypoint-initdb.d 自动执行 / 运维手动 psql -f）
├── tests/backend.test.ts
├── docs/                       # development
├── scripts/                    # acceptance.sh / publish-acr.sh / base-images.lock.env
├── Dockerfile                  # 5 个 target：base/dependencies/builder/production-dependencies/api-runtime/worker-runtime
├── docker-compose.yml          # postgres + backend + worker
├── docker-bake.hcl            # 多架构构建（backend/worker 两个镜像）
├── build-multiarch.sh          # 委托给 scripts/publish-acr.sh
└── .env.example                # 配置模板
```

## 4. 双进程架构

后端运行**两个独立进程**，共享一份代码库但通过 Docker 多阶段构建拆为两个镜像：

```
┌──────────────────────────┐       HTTP push         ┌──────────────────────────┐
│  api-runtime (Fastify)   │  ─────────────────────▶│  worker-runtime (Fastify)│
│  ─ server.js             │  POST /pubsub/backups   │  ─ worker.js             │
│  ─ 处理客户端请求        │  BackupCreatedEvent     │  ─ 消费事件              │
│  ─ JWT 鉴权 + 路由       │                        │  ─ 执行保留策略          │
│  ─ 发布 backup.created   │                        │  ─ Prisma 删旧快照       │
│  ─ Prisma 写入快照       │                        │                          │
└──────────────────────────┘                        └──────────────────────────┘
            │                                                    │
            └──────────── PostgreSQL 15（共享） ────────────────┘
```

- **API 进程**：`dist/server.js`，由 [src/server.ts](src/server.ts) 启动，注册 [app.ts](src/app.ts) 中的全部路由
- **Worker 进程**：`dist/worker.js`，由 [src/worker.ts](src/worker.ts) 启动，注册 [workerApp.ts](src/workerApp.ts) 的 `/pubsub/backups` 接收端点
- 两者共享 [db/prisma.ts](src/db/prisma.ts) 与 [repositories/](src/repositories/) 代码，但通过环境变量分别构建

## 5. 分层与数据流

### 备份上传流程（`POST /api/backups`）

```
Client (PWA/Android)
   │  Authorization: Bearer <JWT>
   │  body: BackupPayload { deviceId?, plans, sessions, exercises, settings }
   ▼
[routes/sync.ts]  ── preValidation: fastify.authenticate (JWT 校验)
   │
   ▼
[schemas/backup.ts]  ── BackupPayloadSchema.safeParse(body)
   │  失败 → throw badRequest
   ▼
[repositories/users.findById(user.id)]  ── 用户存在性校验
   │  失败 → throw unauthorized
   ▼
[repositories/backups.create({userId, deviceId, payload})]
   ├─ prisma.backupSnapshot.create
   └─ prisma.syncMeta.upsert (lastSyncedAt + lastSyncStatus)
   │
   ▼
[events/index.ts → eventPublisher.publishBackupCreated(event)]
   ├─ localPublisher: HTTP POST → worker:8080/pubsub/backups
   └─ 失败：log error 但响应仍成功（事件发布不阻塞响应）
   │
   ▼
reply 200 { success, backupId, syncedAt, eventPublished }
```

### Worker 处理流程（`POST /pubsub/backups`）

```
API (HTTP push)
   │  body: BackupCreatedEvent
   ▼
[workerApp.ts]  ── 校验事件 envelope（eventType/eventVersion/eventId/occurredAt/userId/backupId）
   │  无效 → 400，不执行保留
   ▼
[repositories/backups.pruneExpiredByUserId(userId, { olderThan: 90d, minToKeep: 10 })]
   ├─ 查询受保护快照（最近 N 条）
   └─ prisma.backupSnapshot.deleteMany
   │
   ▼
reply 200
```

## 6. 数据模型

[prisma/schema.prisma](prisma/schema.prisma) 定义四张表：

| 表 | 主键 | 索引 | 关系 |
| --- | --- | --- | --- |
| `users` | `id` (UUID) | `email` unique | → backupSnapshots, syncMeta |
| `email_verification_codes` | `id` (UUID) | `[email, createdAt]` | 独立 |
| `backup_snapshots` | `id` (UUID) | `[userId, createdAt]` | FK → users (Cascade) |
| `sync_meta` | `userId` (UUID) | — | 1:1 → users (Cascade) |

- `backup_snapshots.payload` 为 `Json` 类型，存储客户端 `BackupPayload` 原始对象
- 字段名通过 `@map` 转 snake_case，与 `init.sql` 一致
- MVP 阶段：删除 `prisma/migrations/`，固定 schema 版本为 1；`prisma/init.sql` 全部使用 `CREATE TABLE IF NOT EXISTS` 幂等安全
- 本地 schema 初始化走 postgres 镜像标准 `/docker-entrypoint-initdb.d/` 机制（init.sql 挂载为只读 init 脚本，仅首次创建数据卷时执行）
- 生产 schema 初始化由运维直接 `psql $DATABASE_URL -f prisma/init.sql`
- 运行时镜像**不含 psql、不含 prisma CLI、不含 migrate 入口**

## 7. 仓储抽象（Repository Pattern）

[repositories/types.ts](src/repositories/types.ts) 定义三个接口，[postgres.ts](src/repositories/postgres.ts) 与 [mock.ts](src/repositories/mock.ts) 分别实现：

```typescript
interface UserRepository {
  findByEmail(email): Promise<UserRecord | null>;
  findById(id): Promise<UserRecord | null>;
  create({email, name?, avatarUrl?}): Promise<UserRecord>;
  listAll(): Promise<UserWithStats[]>;           // 管理后台用
  findStatsById(id): Promise<UserWithStats | null>; // 管理后台用
}

interface BackupRepository {
  create({userId, deviceId?, payload}): Promise<BackupRecord>;
  getLatestByUserId(userId): Promise<BackupRecord | null>;
  listByUserId(userId): Promise<BackupRecord[]>;   // 管理后台用
  findById(id): Promise<BackupRecord | null>;       // 管理后台用
  pruneExpiredByUserId(userId, {olderThan, minToKeep}): Promise<number>;
}
```

- [repositories/index.ts](src/repositories/index.ts) 根据 `env.DATA_MODE` 在 `postgres` / `mock` 之间切换
- 路由层 **不直接 import Prisma**，所有数据访问通过 `repositories` 命名空间
- 事件层 [events/index.ts](src/events/index.ts) 根据 `env.EVENT_PUBLISHER` 在 `local` / `mock` 之间切换

## 8. 配置管理

[src/config/env.ts](src/config/env.ts)：

- 启动时通过 dotenv 加载 `backend/.env`
- 每个变量支持 `*_FILE` 后缀（Docker secrets）：`${KEY}` 与 `${KEY}_FILE` 不能同时设置
- 关键模式开关：
  - `AUTH_MODE` = `email`（生产）/ `mock`（测试）
  - `DATA_MODE` = `postgres`（生产）/ `mock`（测试）
  - `EVENT_PUBLISHER` = `local`（HTTP push）/ `mock`（日志）
- 鉴权密钥：`JWT_SECRET`、`ADMIN_TOKEN`（为空则禁用 `/admin/*` 返回 404）

完整配置项见 [.env.example](.env.example)。

## 9. 构建与镜像

[Dockerfile](Dockerfile) 五个 target，最终产出两个运行时镜像：

```
base (node:24.19.0-alpine)
  ├── dependencies     # npm ci（含 devDeps，仅供编译）
  │     └── builder    # prisma generate + tsc
  └── production-dependencies  # npm ci --omit=dev --omit=optional --ignore-scripts
        ├── api-runtime       # 仅 dist + node_modules + .prisma，CMD node dist/server.js
        └── worker-runtime    # 仅 dist + node_modules + .prisma，CMD node dist/worker.js
```

硬约束：

- 运行时镜像不得包含 TypeScript / tsx / prisma CLI / psql / 源码 / 测试
- 不内置 migrate 入口；schema 初始化在容器外完成
- 镜像 tag 必须包含 Git commit SHA + Build ID，不允许仅 `latest`
- Worker 镜像必须自带 `CMD ['node', 'dist/worker.js']`，不依赖 compose 覆盖
- 支持 AMD64 + ARM64（[build-multiarch.sh](build-multiarch.sh) / [docker-bake.hcl](docker-bake.hcl)）

[docker-bake.hcl](docker-bake.hcl) 仅构建 `backend` 与 `worker` 两个 target，不再产出 maintenance/postgres/caddy 镜像。

## 10. 部署形态

### 10.1 本地 Docker（docker-compose.yml）

三服务编排：`postgres` + `backend` + `worker`。依赖链：`PostgreSQL healthy → Worker healthy → Backend healthy`。

- schema 初始化走 postgres 镜像 `/docker-entrypoint-initdb.d/` 机制，挂载 [prisma/init.sql](prisma/init.sql) 为只读 init 脚本，**仅在数据卷首次创建时执行**
- HTTPS 终结由前端 nginx 或独立 Caddy 承担
- 不含 frontend 服务，前端单独部署在 `pwa/`

### 10.2 生产部署

生产部署不在仓库内提供专用 compose 或运维脚本。通用做法：

- 用 [scripts/publish-acr.sh](scripts/publish-acr.sh) 发布镜像，得到 `backend/scripts/images.lock.env`（含 `sha256:` digest）
- 运维在自己环境创建 `docker-compose.override.yml` 引用具体 digest，配置 secrets 与 HTTPS 网关
- 运维直接 `psql $DATABASE_URL -f prisma/init.sql` 初始化 schema
- 备份/巡检由运维用自己工具链（restic / systemd / 云厂商方案）承担

仓库刻意不为某种部署目标（树莓派、K8s、云主机）维护专用目录，避免出现「特殊打包专用目录或文件」。

### 10.3 网关层约束（详见 [../docs/部署手册.md](../docs/部署手册.md)）

- HTTPS 必须在独立网关层（Caddy / nginx）终结，内部服务走 Docker 网络
- 网关必须暴露 `/healthz` `/readyz` `/health` `/api/*`
- Fastify 必须启用 `trustProxy: true`，确保 `request.protocol` 与 `request.ip` 通过代理后准确
- 本地 HTTPS 网关必须显式声明 `https://localhost, https://127.0.0.1` 主机名
- 生产 `CORS_ORIGIN` 只允许 HTTPS origin，禁止通配符

## 11. 管理后台

[routes/admin.ts](src/routes/admin.ts) 提供服务端渲染 HTML 页面：

- `GET /admin` — 用户列表（邮箱、姓名、注册时间、备份数、最近备份、最近同步）
- `GET /admin/users/:id` — 用户详情 + 备份快照列表
- `GET /admin/backups/:id` — 备份 Payload JSON 查看

鉴权：`ADMIN_TOKEN` 为空 → 404；非空 → 通过 `?token=xxx` 或 `Authorization: Bearer xxx` 访问。生产建议叠加网关层 IP 白名单。

## 12. 测试策略

- 单测：[tests/backend.test.ts](tests/backend.test.ts) 覆盖 API + Worker（用 `DATA_MODE=mock` `EVENT_PUBLISHER=mock` `AUTH_MODE=mock`）
- 验收：[scripts/acceptance.sh](scripts/acceptance.sh) 检查容器状态、Backend/Worker 健康、版本接口、镜像隔离（含 Prisma Client 不含 Prisma CLI）
- 命令门槛：`npm run typecheck` + `npm run build` + `npm test` 必须全绿才允许部署

## 13. 相关文档

- [README.md](README.md) — 快速开始
- [docs/development.md](docs/development.md) — 本地开发环境搭建
- [../docs/部署手册.md](../docs/部署手册.md) — 跨端部署手册
- [../docs/architecture-decision.md](../docs/architecture-decision.md) — 拆分决策
- [../pwa/architecture.md](../pwa/architecture.md) — PWA 架构
- [../android/architecture.md](../android/architecture.md) — Android 架构

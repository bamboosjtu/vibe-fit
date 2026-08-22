# VibeFit Backend

PWA 与 Android 的共同云端备份服务。后端**只做备份**：用户主动触发时，前端将本地全量数据打成一个 JSON 快照上传，后端存入 PostgreSQL；需要时拉取最新一份恢复到本地。本地数据（IndexedDB / SQLite）始终是唯一可信源。

## 备份了什么

前端导出的 `BackupPayload`（zod schema 定义在 [schemas/backup.ts](./src/schemas/backup.ts)）是一份全量快照，包含用户全部离线数据：

| 字段 | 类型 | 内容 |
| --- | --- | --- |
| `schemaVersion` | number | 快照 schema 版本（当前 1） |
| `exportedAt` | ISO datetime | 导出时间 |
| `appVersion` | string | 导出时的应用版本 |
| `deviceId` | string? | 导出设备标识（仅元数据，不影响业务） |
| `settings` | object | 用户设置（重量单位、距离单位、暗色模式） |
| `plans` | TrainingPlan[] | 全部训练计划（含 days → phases → groups → exercises 完整结构） |
| `sessions` | TrainingSession[] | 全部训练历史（含 exercises → sets 每组记录、cardioRecord 有氧记录、notes 笔记） |
| `exercises` | Exercise[] | 动作库（力量动作 + 有氧器械定义） |

schema 与前端共享：[`pwa/src/types/index.ts`](../pwa/src/types/index.ts) 的 `ExportDataSchema` 是同一份契约，前后端同步更新。

## 数据存储

PostgreSQL 四张表（[prisma/schema.prisma](./prisma/schema.prisma)）：

| 表 | 作用 | 关键字段 |
| --- | --- | --- |
| `users` | 用户账号 | `id`(UUID) · `email`(unique) · `name` · `avatar_url` |
| `email_verification_codes` | 邮箱验证码 | `email` · `code` · `expires_at` · `consumed_at` |
| `backup_snapshots` | 备份快照 | `id`(UUID) · `user_id` · `device_id` · `payload`(JSON) · `created_at` |
| `sync_meta` | 同步元数据 | `user_id`(PK) · `last_synced_at` · `last_sync_status` |

`backup_snapshots.payload` 是 JSON 列，直接存 `BackupPayload` 全文。每用户可有多条快照，按 `created_at` 倒序取最新。

## 数据流向

```text
PWA / Android（本地 IndexedDB / SQLite）
  │
  │  ① POST /api/backups（JWT 认证 + BackupPayload 全量快照）
  ▼
Backend（Fastify API，:8080）
  ├── zod 校验 payload 格式
  ├── 写入 backup_snapshots（user_id + device_id + payload JSON）
  ├── upsert sync_meta（last_synced_at = now, status = success）
  └── HTTP push 发布 backup.created 事件
        │
        │  ② POST /pubsub/backups（Pub/Sub wire format）
        ▼
Worker（Fastify Worker，独立进程）
  ├── 解析 backup.created 事件（eventId / userId / backupId）
  ├── pruneExpiredByUserId(userId, { olderThan: 90天前, minToKeep: 10 })
  │     ├── 查该用户最新的 10 份快照（保护名单）
  │     └── 删除 90 天前且不在保护名单的快照
  └── 返回 204
        │
        ▼
PostgreSQL
  ├── users
  ├── email_verification_codes
  ├── backup_snapshots  ← ① 写入 / ② 清理
  └── sync_meta         ← ① 更新
```

恢复流程（拉取）：

```text
PWA / Android
  │  GET /api/backups/latest（JWT 认证）
  ▼
Backend
  └── 查 backup_snapshots WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
      → 返回 payload JSON
      （无快照时返回 { data: null, syncedAt: null }）
```

## API 端点

| 方法 | 路径 | 认证 | 用途 |
| --- | --- | --- | --- |
| `POST` | `/api/auth/send-code` | 无 | 发送邮箱验证码 |
| `POST` | `/api/auth/verify-code` | 无 | 验证码校验，签发 JWT |
| `GET` | `/api/me` | JWT | 当前用户信息 |
| `POST` | `/api/backups` | JWT | 推送全量快照 |
| `GET` | `/api/backups/latest` | JWT | 拉取最新快照 |
| `GET` | `/health` `/healthz` `/readyz` | 无 | 存活/就绪探针 |
| `GET` | `/api/version` | 无 | 版本信息 |
| `POST` | `/pubsub/backups` | 内部 | Worker 接收 backup.created push |

## 认证

邮箱验证码 + JWT，Android 与 PWA 共用同一登录链路：

1. 前端调 `POST /api/auth/send-code`，后端生成 6 位验证码，通过 163 SMTP 发到用户邮箱
2. 前端调 `POST /api/auth/verify-code`，后端校验验证码（未过期 + 未消费），自动注册或登录，签发 JWT
3. 后续请求携带 `Authorization: Bearer <jwt>`，后端 `preValidation` 钩子解析验签

验证码 15 分钟过期，消费后标记 `consumed_at`。

## Worker 清理策略

Worker 监听 `backup.created` 事件，执行幂等清理（[workerApp.ts](./src/workerApp.ts)）：

- **保留窗口**：90 天（`BACKUP_RETENTION_DAYS`，可配置）
- **最低保留**：每用户至少保留最新 10 份快照（`BACKUP_MIN_SNAPSHOTS`，可配置）
- **清理逻辑**：先查出该用户最新 N 份加入保护名单，再删除 90 天前且不在保护名单的记录

清理在每次推送备份后触发一次，不需要定时任务。

## 本地开发

```bash
cd backend
npm install
cp .env.example .env        # 至少设置 32 字符的 JWT_SECRET 与 SMTP 参数
npm run dev                 # API（:8080）
npm run dev:worker          # Worker（独立进程）
npm run typecheck
npm run build
```

Docker 本地栈与部署架构见 [`docs/deployment.md`](./docs/deployment.md)；跨端部署架构见 [`../docs/deployment-architecture.md`](../docs/deployment-architecture.md)。数据库 schema 初始化通过 `prisma/init.sql` 执行：本地由 postgres 容器首次启动自动跑（挂载到 `/docker-entrypoint-initdb.d/`），生产由运维直接 `psql -f prisma/init.sql`；本地开发也可用 `npm run db:push`（`prisma db push`）。

## 关键约束

- **平台无关**：API 不区分客户端类型；`deviceId` 仅作元数据，不影响业务行为
- **数据契约唯一**：`BackupPayloadSchema` 是备份 payload 的唯一权威，前后端同步更新
- **全量快照**：每次推送都是全量覆盖，不做增量同步、不做字段级合并
- **事件可插拔**：当前 `LocalHttpEventPublisher`（HTTP push 模拟 Pub/Sub wire format），未来可替换为 GCP Pub/Sub
- **Schema 走脚本**：MVP 期间通过 `prisma/init.sql` 初始化，不提供自动化 migrate 服务，运行时镜像不含 psql、不含 Prisma CLI

# 开发指南

本文件面向 VibeFit PWA 的开发者，整合系统架构、后端 API 契约与数据库设计。部署相关内容见 [deployment.md](./deployment.md)（本地 Docker）与 [gcloud.md](./gcloud.md)（GCP 可选云端）。Android 端架构见 [android/docs/android-architecture.md](../../android/docs/android-architecture.md)。

## 1. 系统架构

VibeFit 是一个移动端优先的离线优先 PWA。前端本地数据为唯一可信源，后端仅用于可选的云端全量快照备份/恢复，不参与日常读写。

![部署架构图](./部署架构图.png)

### 本地开发环境链路

```
浏览器 / 前端 dev server
  ↓
Vite frontend
  ↓ HTTP
Backend API，本地 Node.js / Fastify
  ↓
Docker PostgreSQL
  ↓
本地事件模拟
  ├── 方案 A：直接函数调用 / EventEmitter
  └── 方案 B：本地 Worker HTTP endpoint
```

### 离线优先数据流

```
UI → Zustand store → Dexie (IndexedDB) → 返回 UI     # 全程不依赖网络
                ↓（可选，手动/定时）
        exportAllData() → SyncService → 后端 /api/backups
```

## 2. 前端技术栈

| 技术                    | 用途                         |
| ----------------------- | ---------------------------- |
| **React 19**            | UI 框架                      |
| **TypeScript**          | 类型安全                     |
| **Vite 7**              | 构建工具                     |
| **MUI (Material UI) 7** | UI 组件库                    |
| **Zustand**             | 状态管理                     |
| **Dexie.js**            | IndexedDB 封装（本地数据库） |
| **Vite PWA**            | 渐进式 Web 应用              |
| **zod**                 | 数据契约校验（前后端共享）   |

### 状态管理架构

```
┌─────────────────────────────────────────────────────────┐
│                    Zustand Stores                       │
├─────────────────┬─────────────────┬─────────────────────┤
│   planStore     │  sessionStore   │   settingsStore     │
│  (训练计划)     │  (训练会话)     │    (应用设置)        │
└────────┬────────┴────────┬────────┴──────────┬──────────┘
         │                 │                   │
         └─────────────────┼───────────────────┘
                           ▼
                  ┌─────────────────┐
                  │   Dexie (IDB)   │
                  │   本地数据库    │
                  └─────────────────┘
```

> 数据访问层正在抽象为统一的 `DataRepository` 接口（见 `pwa/frontend/src/db/repository.ts`），未来 Web 用 Dexie、Android 用 SQLite，上层 store 与组件无需改动。详见 [android/docs/android-architecture.md](../../android/docs/android-architecture.md)。

## 3. 后端 API

后端使用 **Node.js + TypeScript + Fastify** 构建，为离线优先的前端提供可选的云端同步和备份层。

本地 Docker 部署使用 PostgreSQL（Prisma）；测试模式（`DATA_MODE=mock`）使用内存模拟数据库（`pwa/backend/src/mockDb.ts`）验证 API 逻辑。

### 运行模式

后端通过三个环境变量切换模式，**mock 仅用于测试，需单独跑**：

| 变量 | 取值 | 说明 |
| --- | --- | --- |
| `AUTH_MODE` | `email`（默认）/ `mock` | `email`：邮箱验证码登录（163 SMTP）；`mock`：验证码直接返回不发邮件 |
| `DATA_MODE` | `postgres`（默认）/ `mock` | `postgres`：PostgreSQL；`mock`：内存数据 |
| `EVENT_PUBLISHER` | `local`（默认）/ `mock` | `local`：HTTP push 到本地 worker；`mock`：仅日志输出 |

### 3.1 基础 URL

开发与本地联调环境：`http://localhost:8080`。

### 3.2 接口概览

#### 健康检查与元数据

- `GET /health`：负载均衡器的标准健康检查（返回 `{ status: "ok" }`）。
- `GET /api/version`：返回 API 版本和环境信息（`authMode` / `dataMode`）。

#### 身份验证（邮箱验证码登录，无密码）

- `POST /api/auth/send-code`：发送验证码到邮箱。
  - 请求体：`{ "email": "user@example.com" }`
  - `email` 模式：通过 163 SMTP 发送 6 位验证码，返回 `{ success: true, message }`。
  - `mock` 模式：不发邮件，验证码放在 `devCode` 字段返回，便于测试。
- `POST /api/auth/verify-code`：校验验证码并登录/注册。
  - 请求体：`{ "email": "user@example.com", "code": "123456" }`
  - 校验通过后签发 JWT，自动完成登录或注册，返回 `{ success: true, token, user }`。
- `GET /api/me`：返回当前已通过验证的用户信息。
  - 鉴权：`Authorization: Bearer <token>`

> SMTP 配置（163 邮箱）与部署步骤见 [deployment.md](./deployment.md)。

#### 同步与备份

这些接口接受和返回整个应用程序状态（IndexedDB 快照），以支持离线优先架构。

- `POST /api/backups`：将本地应用状态推送到云端。
  - 鉴权：`Authorization: Bearer <token>`
  - 请求体：
    ```json
    {
      "schemaVersion": 1,
      "exportedAt": "ISOString",
      "appVersion": "1.0.0",
      "settings": {},
      "plans": [],
      "sessions": [],
      "exercises": []
    }
    ```
  - 响应：`{ "success": true, "syncedAt": "ISOString", "message": "..." }`

- `GET /api/backups/latest`：从云端拉取最新的备份状态。
  - 鉴权：`Authorization: Bearer <token>`
  - 响应：
    ```json
    {
      "success": true,
      "data": {
        "schemaVersion": 1,
        "exportedAt": "ISOString",
        "appVersion": "1.0.0",
        "settings": {},
        "plans": [],
        "sessions": []
      },
      "syncedAt": "ISOString"
    }
    ```

> Google 登录链路（生产）见 [gcloud.md](./gcloud.md) 的 OAuth2 章节。

## 4. 数据库设计

Vibe-Fit 采用离线优先（Offline-First）的设计模式。

- **前端本地存储**：使用 IndexedDB（通过 Dexie.js 封装）作为主存储，确保在无网络环境下也能正常操作。
- **后端云端存储**：使用 PostgreSQL（本地 Docker 或 GCP Cloud SQL）作为备份和同步存储。

### 4.1 前端数据库（IndexedDB / Dexie.js）

数据库名称：`VibeFitDB`

#### `exercises`（动作库）

- `id` (string)：主键
- `name` (string)：动作名称
- `type` (string)：动作类型（如 strength、cardio）

#### `plans`（训练计划）

- `id` (string)：主键
- `name` (string)：计划名称
- `isCurrent` (boolean)：是否为当前执行计划
- `isActive` (boolean)：是否激活

#### `sessions`（训练记录）

- `id` (string)：主键
- `planId` (string)：所属计划 ID
- `startedAt` (string)：开始时间（ISO）
- `endedAt` (string)：结束时间（ISO）

#### `settings`（应用设置）

- `weightUnit` (string)：重量单位（kg/lb）
- `distanceUnit` (string)：距离单位（km/mile）
- `darkMode` (boolean)：夜间模式

#### `pendingTraining`（未完成训练状态）

- `id` (string)：主键
- `planId` (string)
- `updatedAt` (string)

#### `syncQueue`（同步队列）

用于记录本地变更，待网络恢复后同步（当前版本主要使用全量备份）。

- `id` (string)：主键
- `table` (string)
- `recordId` (string)
- `action` (create/update/delete)
- `createdAt` (string)

#### `syncMeta`（同步元数据）

- `id` (string)：主键
- `lastSyncedAt` (string)
- `lastSyncStatus` (string)
- `deviceId` (string)

> Android 端 SQLite 表结构（混合模型：顶层实体独立表 + 嵌套 JSON 列）见 [android/docs/android-architecture.md](../../android/docs/android-architecture.md) 的"本地数据库设计"章节。

### 4.2 后端数据库（PostgreSQL / Prisma）

#### `User`（用户表）

- `id` (Uuid)：主键
- `email` (String)：唯一
- `passwordHash` (String)：密码哈希
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

#### `BackupSnapshot`（备份快照表）

存储用户完整数据的 JSON 快照。

- `id` (Uuid)：主键
- `userId` (Uuid)：外键，关联 User
- `deviceId` (String)：设备标识
- `payload` (Json)：包含 plans、sessions、settings、exercises 的完整 JSON 数据
- `createdAt` (DateTime)

#### `SyncMeta`（同步元数据表）

- `userId` (Uuid)：主键，关联 User
- `lastSyncedAt` (DateTime)
- `lastSyncStatus` (String)

> Prisma schema 定义在 `pwa/backend/prisma/schema.prisma`，迁移文件在 `pwa/backend/prisma/migrations/`。

### 4.3 同步策略

当前版本采用 **全量快照备份（Snapshot-based Backup & Restore）** 策略：

- **Push（推送）**：前端将本地 IndexedDB 中的所有核心数据导出为 JSON Payload，调用 `POST /api/backups` 接口存入云端的 `backup_snapshots` 表。
- **Pull（拉取）**：前端调用 `GET /api/backups/latest` 获取该用户最新的 JSON 快照，并将其覆盖导入到本地 IndexedDB 中，实现跨设备同步或数据恢复。

> 当前不做字段级合并；多设备场景以最新快照为准。未来如需增量同步，可启用预留的 `syncQueue` 表。

## 5. 本地开发命令

```bash
# 前端
cd pwa/frontend
npm run dev          # 启动 Vite dev server
npm run build        # 构建（含 tsc -b）
npm run lint         # ESLint
npm test             # Vitest

# 后端
cd pwa/backend
npm run dev          # 启动后端 API watcher
npm run dev:worker   # 启动 worker watcher
npm run build        # 构建
npm run typecheck    # 类型检查
npm run db:migrate   # Prisma 开发迁移

# 一体化本地部署
cd pwa
docker compose up -d --build
```

详细部署说明见 [deployment.md](./deployment.md)。

## 6. 测试

- 前端单测：Vitest + Testing Library + jsdom，setup 在 `pwa/frontend/src/__tests__/setup.ts`，测试放在 `pwa/frontend/tests/`（`*.test.ts` / `*.test.tsx`）。
- 前端 E2E：Playwright，覆盖四大页面与训练全流程。
- 后端：暂未配置测试，改后端行为前先跑 `npm run typecheck` 与 `npm run build`。
- 数据校验：导入/导出/同步 payload 全部走 `pwa/frontend/src/types/index.ts` 的 zod schema。

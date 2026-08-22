# 后端架构决策：Android + H5 双端共支撑（已落地为独立 `backend/`）

## 1. 背景

VibeFit 存在两个构建目标：

- **H5 / PWA**（`pwa/`）：React 前端，纯前端离线优先，本地 Dexie（IndexedDB）做唯一可信源。
- **Android**（`android/`）：用 Capacitor 8 封装同一套 React 前端，本地存储切换为 SQLite。

两端都是**离线优先**：本地数据为唯一可信源，后端仅用于可选的云端全量快照备份/恢复。

需要决策：后端应该**独立为单独服务**，还是**继续与前端共部署**，才能同时支撑 Android 和 H5？

## 2. 历史决策与反转

### 2.1 原决策（共部署）

早期决策（详见本文 git 历史）选择**方案 B：维持共部署**，理由是应用未发布、只有本地 Docker 部署，无独立扩缩容需求；前后端同仓库方便契约演进同步。

### 2.2 反转触发

随着 PWA 离线化推进与 Android 端开发启动，出现以下信号：

1. **PWA 离线优先**：PWA 应是纯前端 H5，前端 nginx 不应依赖 backend 容器才能启动。共部署让"前端容器必须等待 backend 健康"成为反模式。
2. **Android 双端共用后端**：Android 与 PWA 调用同一组后端 API，需要后端作为独立部署单元被两端引用，而不应"嵌入"在某一个前端目录中。
3. **本地开发独立**：前端开发只需 `cd pwa && npm run dev`，不应被 backend/docker-compose 的 postgres/worker 进程占用资源或端口。
4. **构建产物分离**：前端镜像（nginx + 静态资源 + SW）与后端镜像（Fastify + Prisma）应有独立的 Dockerfile、bake、publish 流程，避免互相污染。

### 2.3 反转决策

**采用方案 A：后端独立为顶层 `backend/` 目录**，作为 PWA 与 Android 的共同云端备份服务。前端 PWA 独立部署，不依赖 backend 容器即可完整运行；Android 复用同一 `backend/` API。

## 3. 现状（已落地）

仓库拆分为四个顶层目录：

| 目录 | 角色 | 容器栈 |
| --- | --- | --- |
| `docs/` | 跨端共享：UI 设计、数据契约、架构决策 | 无 |
| `pwa/` | 纯前端 H5/PWA（React 19 + Vite，离线优先） | `docker-compose.yml` 仅 `frontend`（:8081） |
| `backend/` | Fastify + Prisma 后端（PWA 与 Android 共同云端备份） | `docker-compose.yml` 含 `postgres` + `migrate` + `backend` + `worker`（:8080） |
| `android/` | Capacitor 安卓工程，复用 `pwa/dist` 构建产物 | 无（APK/AAB） |

镜像构建也对应拆分：

- `pwa/docker-bake.hcl` → `vibefit-frontend`（nginx + 构建产物 + SW）
- `backend/docker-bake.hcl` → `vibefit-backend` / `vibefit-worker` / `vibefit-maintenance` / `vibefit-postgres` / `vibefit-caddy`（树莓派生产套件）
- 树莓派一体化生产部署（Caddy + Frontend + Backend + Worker + Postgres）由 `backend/deploy/rpi/compose.yaml` 编排，通过 `FRONTEND_IMAGE` 引用 `pwa/` 构建发布的前端镜像。

## 4. 后端已天然平台无关

后端提供的全部能力：

| 能力 | 端点 | 平台相关性 |
| --- | --- | --- |
| 健康检查 | `GET /health`、`GET /api/version` | 无 |
| 邮箱验证码登录 | `POST /api/auth/send-code`、`POST /api/auth/verify-code` | 无（邮箱是通用标识） |
| 当前用户 | `GET /api/me` | 无 |
| 推送备份 | `POST /api/backups` | 无（接受 JSON 快照） |
| 拉取备份 | `GET /api/backups/latest` | 无（返回 JSON 快照） |

- **认证**：邮箱验证码 → JWT，与平台无关。Android 与 H5 走完全相同的登录链路。
- **备份格式**：`ExportData` zod schema（定义在 `pwa/src/types/index.ts`），是前后端、Web/Android 共享的唯一数据契约。两端 `repository.exportAllData()` 产出的 JSON 结构一致。
- **无平台分支**：后端代码里没有任何 `if android / if web` 逻辑，也不区分客户端类型。

## 5. 模块化保障措施

为保持后端无冲突适配 Android 和 H5，需遵守以下约束：

### 5.1 后端不得引入平台分支

- 禁止在后端代码中出现 `if client === 'android'` 之类的分支逻辑。
- 客户端类型仅作为 `deviceId` / `userAgent` 等元数据记录，不影响业务行为。

### 5.2 备份格式以 zod schema 为唯一契约

- `ExportDataSchema`（`pwa/src/types/index.ts`）是备份 payload 的唯一权威定义。
- 后端 `POST /api/backups` 接受该 schema 的 JSON，存储为 `BackupSnapshot.payload`（Json 列）。
- 两端的 `repository.exportAllData()` 必须产出符合该 schema 的数据；schema 变更时前后端同步更新。

### 5.3 认证统一为邮箱验证码 + JWT

- 不为 Android 引入单独的认证方式（如设备 ID 登录）。
- Android 与 H5 共用 `/api/auth/send-code` + `/api/auth/verify-code`，JWT 是唯一的会话凭证。

### 5.4 后端配置通过环境变量注入

- 所有运行时配置（数据库、SMTP、JWT secret、CORS、worker URL）通过 `.env` + `docker-compose.yml` 的 `env_file` / `environment` 注入。
- 不在代码中硬编码任何环境相关值。
- CORS_ORIGIN 已支持多 origin 逗号分隔，可同时放行 H5 与 Android WebView 的来源。

### 5.5 事件系统保持可插拔

- 当前用 `LocalHttpEventPublisher`（HTTP push 模拟 Pub/Sub wire format）。
- `EVENT_PUBLISHER` 环境变量可切换 `local` / `mock`，未来可扩展 `pubsub`（GCP）或其他实现。
- worker 端点 `/pubsub/backups` 接受与 GCP Pub/Sub push 相同的 body 结构，便于未来平滑迁移。

### 5.6 镜像与部署分离

- `pwa/docker-bake.hcl` 与 `backend/docker-bake.hcl` 相互独立，不交叉引用。
- 本地开发 compose 已拆分：前端栈不启动 backend，后端栈不启动 frontend；联调时手动加入同一 Docker 网络或通过 `VITE_API_BASE_URL` 指向 backend。
- 树莓派生产 compose（`backend/deploy/rpi/compose.yaml`）通过镜像 tag 引用前端镜像，不耦合构建。

## 6. PWA 与 Android 的前端共享

- Android（`android/`）通过 `capacitor.config.ts` 的 `webDir: '../pwa/dist'` 引用 PWA 构建产物，**不 fork 前端代码**。
- 平台差异（IndexedDB vs SQLite、原生通知、文件系统等）通过 `pwa/src/services/nativeBridge.ts` 与 `pwa/src/services/capacitorBridge.ts` 抽象，UI 层不写平台分支。
- 数据访问统一走 `DataRepository` 接口（`pwa/src/db/repository.ts`），Web 用 `DexieRepository`、Android 用 `SqliteRepository`。

## 7. 结论

后端已从 `pwa/backend/` 抽离为顶层 `backend/` 目录，独立 Dockerfile、compose、bake、发布脚本，作为 PWA 与 Android 的共同云端备份服务。前端 PWA 独立部署，离线优先，不依赖 backend 容器即可完整运行。Android 通过 Capacitor 复用 `pwa/dist` 构建产物，调用同一组后端 API 完成可选云端备份。后端模块化设计（平台无关 API、统一 zod 契约、环境变量配置、可插拔事件系统）确保两端可以零代码改动平滑共用。

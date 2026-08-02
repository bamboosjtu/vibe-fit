# 后端架构决策：Android + H5 双端共支撑

## 1. 背景

VibeFit 当前存在两个构建目标：

- **H5 / PWA**（`pwa/`）：React 前端 + Fastify 后端，本地 Docker 一体化部署。前端用 Dexie（IndexedDB）做本地存储。
- **Android**（`android/`）：用 Capacitor 8 封装同一套 React 前端，本地存储切换为 SQLite。

两端都是**离线优先**：本地数据为唯一可信源，后端仅用于可选的云端全量快照备份/恢复。

需要决策：后端应该**独立为单独服务**，还是**继续与前端共部署**，才能同时支撑 Android 和 H5？

## 2. 现状分析

### 2.1 后端已是平台无关的

当前后端（`pwa/backend/`）提供的全部能力：

| 能力 | 端点 | 平台相关性 |
| --- | --- | --- |
| 健康检查 | `GET /health`、`GET /api/version` | 无 |
| 邮箱验证码登录 | `POST /api/auth/send-code`、`POST /api/auth/verify-code` | 无（邮箱是通用标识） |
| 当前用户 | `GET /api/me` | 无 |
| 推送备份 | `POST /api/backups` | 无（接受 JSON 快照） |
| 拉取备份 | `GET /api/backups/latest` | 无（返回 JSON 快照） |

- **认证**：邮箱验证码 → JWT，与平台无关。Android 与 H5 走完全相同的登录链路。
- **备份格式**：`ExportData` zod schema（定义在 `pwa/frontend/src/types/index.ts`），是前后端、Web/Android 共享的唯一数据契约。两端 `repository.exportAllData()` 产出的 JSON 结构一致。
- **无平台分支**：后端代码里没有任何 `if android / if web` 逻辑，也不区分客户端类型。

### 2.2 前端数据层已抽象

`pwa/frontend/src/db/repository.ts` 定义了 `DataRepository` 接口，运行时根据 `Capacitor.isNativePlatform()` 选择实现：

- Web/PWA → `DexieRepository`（IndexedDB）
- Android → `SqliteRepository`（SQLite）

上层 Zustand store 与组件对底层存储无感知，业务代码零改动。

### 2.3 API 客户端已可配置

`pwa/frontend/src/services/apiClient.ts` 通过 `VITE_API_BASE_URL` 环境变量指向后端地址：

- H5 本地 Docker：构建期注入 `http://localhost:8080`
- Android：可在 Capacitor 构建期注入任意后端 URL（局域网 / 公网均可）

### 2.4 部署已是容器分离的

`pwa/docker-compose.yml` 中前端（nginx）与后端（fastify）本就是**独立容器**，只是被同一个 compose 文件编排在一起。"共部署"的含义是「一次 `docker compose up` 起全栈」，而非「前后端耦合在同一进程」。

## 3. 方案对比

### 方案 A：后端独立为单独服务

将后端从 `pwa/` 抽离为顶层 `backend/` 目录，独立 Dockerfile 与部署流程，前端单独部署。

| 维度 | 评价 |
| --- | --- |
| 可扩展性 | 后端可独立扩缩容，适合多端高并发场景 |
| 维护成本 | 需要维护两套部署流程；本地开发要分别启动前后端 |
| 开发效率 | 前后端仓库/目录分离后，跨层联调路径变长 |
| 当前收益 | 极低——应用未发布，只有本地部署，无扩缩容需求 |

### 方案 B：维持共部署，确保后端模块化（推荐）

保持 `pwa/docker-compose.yml` 一体化编排，但持续保证后端的平台无关性与模块边界。

| 维度 | 评价 |
| --- | --- |
| 可扩展性 | 后端已是独立容器，未来需要时可直接抽出，无需改代码 |
| 维护成本 | 一条命令起全栈，本地开发与部署最简 |
| 开发效率 | 前后端同仓库，类型契约共享，联调最快 |
| 当前收益 | 高——匹配「未发布、本地部署」的现状 |

## 4. 决策

**采用方案 B：维持共部署，确保后端模块化。**

理由：

1. **后端已经天然支持双端。** 认证、备份、同步全部是平台无关的 REST API，Android 与 H5 调用的是同一组端点、同一份契约。不需要为 Android 做任何后端改动。
2. **"独立服务"在当前阶段是过度设计。** 应用尚未发布，只有本地 Docker 部署版本，没有独立扩缩容、多环境部署、多团队协作的实际诉求。提前拆分会增加运维复杂度而无实际收益。
3. **共部署不等于耦合。** 前端 nginx 与后端 fastify 是独立容器，通过 Docker 网络通信。后端的代码、依赖、构建产物都与前端无关。未来若要独立部署后端，只需把它从 docker-compose 抽出，**无需改一行后端代码**。
4. **数据契约统一是关键保障。** `pwa/frontend/src/types/index.ts` 的 zod schema 是前后端、Web/Android 共享的唯一数据契约。共部署让契约演进时前后端同步更新，降低不一致风险。

## 5. 模块化保障措施

为确保后端在共部署模式下仍能无冲突适配 Android 和 H5，需遵守以下约束：

### 5.1 后端不得引入平台分支

- 禁止在后端代码中出现 `if client === 'android'` 之类的分支逻辑。
- 客户端类型仅作为 `deviceId` / `userAgent` 等元数据记录，不影响业务行为。

### 5.2 备份格式以 zod schema 为唯一契约

- `ExportDataSchema`（`pwa/frontend/src/types/index.ts`）是备份 payload 的唯一权威定义。
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

## 6. 何时升级为独立服务

出现以下任一信号时，再考虑将后端抽离为独立服务：

1. Android 与 H5 需要连接**不同的后端实例**（如 Android 走公网、H5 走内网）。
2. 后端需要**独立扩缩容**（如备份并发量超过单机承受能力）。
3. 出现**多团队协作**，前后端由不同团队维护，需要独立发布节奏。
4. 需要**多环境部署**（staging / production 分别部署后端）。

届时只需：
- 把 `pwa/backend/` 移到顶层 `backend/`；
- 复用现有 Dockerfile；
- 把 docker-compose 中的 backend / worker / postgres 服务抽到独立 compose 文件；
- 前端的 `VITE_API_BASE_URL` 指向新后端地址。

**无需改动任何后端业务代码。**

## 7. 结论

当前后端架构已经能够同时支撑 Android 和 H5，无需拆分。共部署模式在本地部署阶段提供最低的运维成本与最高的开发效率，同时后端的模块化设计（平台无关 API、统一 zod 契约、环境变量配置、可插拔事件系统）确保了未来需要独立部署时可以零代码改动平滑迁移。

# Android 离线版架构设计

## 1. 背景与目标

VibeFit 当前是一个**前后端分离的移动端优先 PWA**：

- 前端：React 19 + Vite + MUI + Zustand + Dexie.js（IndexedDB），本身已是**离线优先**，本地数据为唯一可信源。
- 后端：Fastify + Prisma + PostgreSQL，仅用于**可选的云端全量快照备份/恢复**，不参与日常读写。

下一步目标是将其改造为**安卓原生离线应用**，核心诉求：

1. 以独立 App 形式安装于安卓桌面（非浏览器内 PWA）。
2. **数据库存储在本地**，无网络也能完整使用全部功能。
3. 最大化复用现有前端代码，避免重写业务逻辑与 UI。
4. 云端备份保留为可选能力，不作为运行依赖。

> 本文件描述安卓版的整体架构。后端架构见 [backend/docs/development.md](../../backend/docs/development.md)；PWA 平台说明见 [../../docs/platforms/pwa.md](../../docs/platforms/pwa.md)。

## 2. 技术选型

### 2.1 容器方案：Capacitor

在「复用现有 React 前端」前提下，对比四种方案：

| 方案 | 代码复用 | 本地 DB 能力 | 原生能力 | 离线打包 | 改造成本 |
| --- | --- | --- | --- | --- | --- |
| **Capacitor** | 整个 React 前端原样复用 | SQLite 原生插件 | 完整插件生态 | Web 资源随 APK 打包 | 低 |
| TWA（Trusted Web Activity） | 复用 PWA | 仅 IndexedDB，无法用 SQLite | 弱 | 需 PWA 在线部署 | 低但受限 |
| React Native | 仅复用业务逻辑/类型，UI 全部重写（MUI→RN 组件） | SQLite | 完整 | 原生打包 | 极高 |
| 原生 Kotlin | 几乎全部重写 | SQLite | 完整 | 原生打包 | 最高 |

**结论：选用 Capacitor。** 它把现有 React 构建产物嵌入 Android WebView，同时提供原生插件桥接，满足「复用 UI + 本地 SQLite + 原生能力 + 完全离线」的全部诉求。

### 2.2 本地数据库：SQLite（@capacitor-community/sqlite）

- IndexedDB 在 WebView 中可用，但 Android 上**结构化数据首选 SQLite**：性能更稳定、事务语义清晰、便于备份与迁移、不受 WebView 存回收影响。
- 采用 `@capacitor-community/sqlite` 插件，提供统一的 JS API。
- 通过**仓储模式（Repository）**封装数据访问，使上层 Zustand store 与组件代码对底层无感知。

### 2.3 技术栈总览

| 层 | 技术 | 说明 |
| --- | --- | --- |
| UI / 业务 | React 19 + MUI 7 + Zustand + zod | 现有前端原样复用 |
| 构建 | Vite 7 | 产物供 Capacitor 打包 |
| 原生壳 | Capacitor 7 | WebView + 原生插件 |
| 本地 DB | SQLite（@capacitor-community/sqlite） | 安卓本地唯一可信源 |
| 数据访问 | Repository 接口 + 双实现 | Dexie（Web）/ SQLite（Android） |
| 原生能力 | Capacitor Plugins | 通知 / 触感 / 文件 / 偏好 |
| 云端同步（可选） | 现有 Fastify 后端 | 全量快照备份/恢复 |
| 打包 | Gradle + Android Studio | APK / AAB |

## 3. 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                   Android App (APK/AAB)                  │
├──────────────────────────────────────────────────────────┤
│  Native Shell (Capacitor)                                │
│   ├── WebView ── 加载打包进 APK 的 React 静态资源         │
│   └── Native Plugins                                     │
│        ├── SQLite            本地数据库                   │
│        ├── Local Notifications 休息计时器 / 训练提醒      │
│        ├── Haptics           完成组/动作触感反馈          │
│        ├── Filesystem        导出/导入备份文件            │
│        ├── Preferences       设备级配置                   │
│        └── Share             系统分享面板                 │
├──────────────────────────────────────────────────────────┤
│  Web Layer（现有 React 应用，打包进 WebView）             │
│   ├── Pages / Components   React 19 + MUI                │
│   ├── Stores               Zustand（plan/session/...）    │
│   ├── Data Access Layer    Repository 接口               │
│   │   ├── DexieRepository    Web/PWA 实现                 │
│   │   └── SqliteRepository   Android 实现（Capacitor）    │
│   ├── Sync Service         可选云端快照同步               │
│   └── Types / Schemas      zod（与后端共享契约）          │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼ （可选，手动/定时）
┌──────────────────────────────────────────────────────────┐
│  现有后端：Fastify + Prisma + PostgreSQL                  │
│  仅 POST /api/backups、GET /api/backups/latest            │
└──────────────────────────────────────────────────────────┘
```

### 数据流

- **读写主路径**：UI → Zustand store → Repository → SQLite（本地）→ 返回 UI。全程不依赖网络。
- **同步路径**（可选）：Repository → exportAllData() → SyncService → 后端 `/api/backups`；恢复时反向。
- **原生能力路径**：UI → Capacitor Plugin（如休息计时到点触发 Local Notification）。

## 4. 本地数据库设计

### 4.1 存储模型选型：混合（关系表 + JSON 列）

现有数据模型是**深层嵌套文档**（plan → days → phases → groups → exercises；session → exercises → sets），与导出/同步的 JSON 格式一致。若完全关系化拆表，会引入大量联表与迁移成本，且与同步快照格式不匹配。

采用**混合模型**：

- 顶层实体（plans / sessions / exercises / settings）为独立表，建立索引字段。
- 嵌套结构（days/phases/groups、exercises/sets）以 **JSON 列**存储，SQLite 原生支持 JSON 函数。
- 兼顾「按顶层字段查询/排序」与「整文档读写/同步」两种访问模式。

### 4.2 表结构

数据库名：`vibefit.db`，版本从 `1` 起步。

#### `exercises`（动作库）

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | 动作 ID |
| name | TEXT | 名称（索引） |
| type | TEXT | strength / cardio（索引） |
| payload | TEXT(JSON) | muscleGroups / description / videoUrl |

#### `plans`（训练计划）

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | 计划 ID |
| name | TEXT | 名称（索引） |
| is_current | INTEGER | 0/1（索引） |
| is_active | INTEGER | 0/1（索引） |
| created_at | TEXT | ISO |
| updated_at | TEXT | ISO |
| payload | TEXT(JSON) | description / currentDayIndex / days[]（含 phases/groups/exercises） |

#### `sessions`（训练记录）

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | 会话 ID |
| plan_id | TEXT | 所属计划（索引） |
| started_at | TEXT | 开始时间（索引，倒序） |
| ended_at | TEXT | 结束时间 |
| payload | TEXT(JSON) | dayId/dayName/exercises[]/sets[]/notes |

#### `settings`（应用设置）

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 固定 1（单行） |
| payload | TEXT(JSON) | weightUnit/distanceUnit/darkMode/schemaVersion |

#### `pending_training`（未完成训练状态）

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 固定 1（单行） |
| plan_id | TEXT | 索引 |
| updated_at | TEXT | 索引 |
| payload | TEXT(JSON) | 完整 TrainingSession |

#### `sync_queue`（同步队列，预留）

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | |
| table | TEXT | 索引 |
| record_id | TEXT | 索引 |
| action | TEXT | create/update/delete |
| payload | TEXT(JSON) | |
| created_at | TEXT | 索引 |
| retry_count | INTEGER | |

#### `sync_meta`（同步元数据）

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 固定 1 |
| last_synced_at | TEXT | |
| last_sync_status | TEXT | |
| last_sync_error | TEXT | |
| device_id | TEXT | |

> 字段命名沿用现有 Dexie schema 语义，确保与 `pwa/src/types/index.ts` 的 zod schema 一一对应。 SQLite schema 文件位于 `pwa/src/db/sqliteSchema.ts`，定义与 `pwa/src/types/index.ts` 的 zod schema 一一对应。

### 4.3 版本与迁移

- 使用 `@capacitor-community/sqlite` 的 `version` 与 `migrate` 能力管理 schema 演进。
- 每次启动校验 `PRAGMA user_version`，按需执行增量迁移脚本。
- 迁移脚本与 `backend/prisma/init.sql` 思路一致：每个版本一个 SQL 文件，顺序执行。

## 5. 数据访问层（Repository 抽象）

这是改造的**核心枢纽**，目的是让上层（Zustand stores）与底层存储解耦，做到「Web 用 Dexie、Android 用 SQLite」而业务代码零改动。

### 5.1 接口定义

在 `pwa/src/db/repository.ts` 中定义统一接口，对齐现有 [db/index.ts](../../pwa/src/db/index.ts) 暴露的方法：

```typescript
export interface DataRepository {
  // 设置
  initDefaultSettings(): Promise<void>;
  getSettings(): Promise<AppSettings | undefined>;
  updateSettings(patch: Partial<AppSettings>): Promise<void>;

  // 计划
  getAllPlans(): Promise<TrainingPlan[]>;
  getCurrentPlan(): Promise<TrainingPlan | undefined>;
  addPlan(plan: TrainingPlan): Promise<void>;
  updatePlan(id: string, patch: Partial<TrainingPlan>): Promise<void>;
  deletePlan(id: string): Promise<void>;
  setCurrentPlan(id: string): Promise<void>;

  // 训练会话
  getAllSessions(): Promise<TrainingSession[]>;
  getSessionById(id: string): Promise<TrainingSession | undefined>;
  getRecentSessions(limit?: number): Promise<TrainingSession[]>;
  addSession(session: TrainingSession): Promise<void>;
  updateSession(id: string, patch: Partial<TrainingSession>): Promise<void>;
  deleteSession(id: string): Promise<void>;

  // 动作库
  getAllExercises(): Promise<Exercise[]>;
  addExercise(exercise: Exercise): Promise<void>;
  addExercises(exercises: Exercise[]): Promise<void>;

  // 未完成训练
  savePendingTraining(state: PendingTrainingState): Promise<void>;
  getPendingTraining(): Promise<PendingTrainingState | undefined>;
  deletePendingTraining(): Promise<void>;

  // 导入导出 / 清空
  exportAllData(): Promise<ExportData>;
  importAllData(data: Partial<ExportData>): Promise<void>;
  clearAllData(): Promise<void>;
}
```

### 5.2 双实现

- `DexieRepository`：封装现有 [db/index.ts](../../pwa/src/db/index.ts) 的 Dexie 调用，保持 Web/PWA 行为不变。
- `SqliteRepository`：基于 `@capacitor-community/sqlite` 实现，JSON 列读写 + 顶层索引查询。

### 5.3 工厂选择

```typescript
import { Capacitor } from '@capacitor/core';

export function createRepository(): DataRepository {
  return Capacitor.isNativePlatform()
    ? new SqliteRepository()
    : new DexieRepository();
}

export const repository = createRepository();
```

### 5.4 Store 改造范围

现有 [planStore.ts](../../pwa/src/stores/planStore.ts)、[sessionStore.ts](../../pwa/src/stores/sessionStore.ts)、[settingsStore.ts](../../pwa/src/stores/settingsStore.ts) 直接 `import { ... } from '../db'`。改造方式：

- 将 `pwa/src/db/index.ts` 的具名导出改为**透传 `repository`**（`export const getAllPlans = () => repository.getAllPlans()`）。
- 或让 store 直接 import `repository`。
- **业务逻辑、计时器、组记录操作等全部保持不变。**

## 6. 离线优先策略

| 维度 | 策略 |
| --- | --- |
| 可信源 | 本地 SQLite，唯一真实数据来源 |
| 读写 | 全部走本地，无网络请求 |
| 启动 | App 打开即读本地，秒开 |
| 中断恢复 | `pending_training` 表持久化未完成训练，24h 内可恢复（沿用现有逻辑） |
| 备份 | 本地文件导出（Filesystem + Share）+ 可选云端快照 |
| 冲突 | 当前沿用「全量快照覆盖」语义，不做字段级合并；多设备场景以最新快照为准 |

## 7. 云端同步（可选）

复用现有后端 [routes/sync.ts](../../backend/src/routes/sync.ts) 与 `POST /api/backups`、`GET /api/backups/latest`，不改后端契约。

- **触发**：设置页手动「备份到云端」/「从云端恢复」，或可选定时任务。
- **前置**：需登录（沿用 [authStore](../../pwa/src/stores/authStore.ts) JWT）。
- **格式**：直接使用 `repository.exportAllData()` 的产物，与现有 `ExportData` zod schema 一致。
- **降级**：无网络/未登录时静默跳过，不影响本地功能。

> 未来如需字段级增量同步，可启用预留的 `sync_queue` 表，但当前版本不实现。

## 8. 原生能力集成

| 能力 | 插件 | 用途 |
| --- | --- | --- |
| 本地通知 | `@capacitor/local-notifications` | 休息计时器到点、训练提醒，App 后台也能响 |
| 触感反馈 | `@capacitor/haptics` | 完成组、结束训练轻震动 |
| 文件系统 | `@capacitor/filesystem` | 导出/导入 JSON 备份文件到应用目录 |
| 分享 | `@capacitor/share` | 调起系统分享发送备份文件 |
| 偏好存储 | `@capacitor/preferences` | 设备级配置（如 deviceId） |
| 应用快捷方式 | `@capacitor-community/app-shortcuts` | 桌面长按 → 「开始训练」 |
| 启动屏 | `@capacitor/splash-screen` | 原生启动屏 |

**休息计时器关键改造**：现有 [sessionStore](../../pwa/src/stores/sessionStore.ts) 的 `restTimer` 在前台用 `setInterval` 递减；Android 上需在计时启动时注册 Local Notification，到点触发，保证后台/锁屏可提示。

## 9. 目录结构

仓库拆分为四个顶层目录：`pwa/`（纯前端 H5/PWA，离线优先）、`backend/`（Fastify + Prisma，PWA 与 Android 的共同云端备份服务）、`android/`（Capacitor 安卓工程）、`docs/`（跨端共享：UI 设计、数据契约、架构决策）。

```
fit-topic/
├── pwa/                            # 纯前端 H5/PWA（React 19 + Vite，离线优先）
│   ├── src/
│   │   ├── db/
│   │   │   ├── repository.ts        # DataRepository 接口 + 平台检测
│   │   │   ├── sqliteSchema.ts      # SQLite 建表/迁移 SQL（Android 用）
│   │   │   ├── dexieRepo.ts          # DexieRepository（Web 实现）
│   │   │   ├── sqliteRepo.ts        # SqliteRepository（Android 实现）
│   │   │   └── index.ts             # 工厂选择 + Dexie 默认导出
│   │   ├── services/
│   │   │   ├── nativeBridge.ts      # 原生能力桥接（Web fallback）
│   │   │   ├── capacitorBridge.ts   # Capacitor 桥接实现
│   │   │   └── apiClient.ts         # 后端 API 调用
│   │   └── ...
│   ├── docker-compose.yml           # 前端本地容器栈（仅 frontend :8081）
│   └── docker-bake.hcl             # 前端镜像多架构构建
├── backend/                        # Fastify + Prisma 后端（PWA 与 Android 共同云端备份）
│   ├── src/
│   ├── prisma/                     # Prisma schema + init.sql（幂等建表 SQL）
│   ├── docker-compose.yml          # 后端本地容器栈（postgres + backend + worker）
│   └── docker-bake.hcl             # 后端镜像多架构构建（backend/worker）
├── android/                        # Capacitor 安卓工程
│   ├── capacitor.config.ts          # webDir → ../pwa/dist
│   ├── package.json                 # Capacitor 8 依赖
│   ├── android/                     # 原生 Android Studio 工程（cap add android 生成）
│   └── docs/
│       └── android-architecture.md  # 本文件
├── docs/                           # 跨端共享：UI 设计、数据契约、架构决策
│   ├── architecture-decision.md
│   ├── platforms/{pwa,android}.md
│   ├── ui/...
│   └── 部署架构图.png
└── README.md / AGENTS.md
```

## 10. 构建与发布

### 开发流程

```bash
# 在 android/ 目录下执行
cd android

# 1. 构建 PWA 前端并同步到原生工程（产物到 ../pwa/dist）
npm run sync

# 2. Android Studio 打开原生工程调试 / 运行
npm run open
```

### 发布产物

- `./gradlew assembleRelease` → 签名 APK（sideload）
- `./gradlew bundleRelease` → 签名 AAB（Play Store）
- 签名 keystore 纳入密钥管理，不提交仓库。

### CI/CD（后续阶段）

- 新增 Android 构建流水线：`npm run build → cap sync → gradle bundleRelease → 上传`。
- 前端单测（Vitest）与 E2E（Playwright）保持绿基线，Android 产物在 CI 中产出。

## 11. 迁移路径（分阶段）

| 阶段 | 目标 | 产物 |
| --- | --- | --- |
| **P1 容器化** | 接入 Capacitor，把现有前端打包进 Android WebView，先用 IndexedDB 跑通 | 可安装 APK，四页面可用 |
| **P2 仓储抽象** | 引入 `DataRepository` 接口，改造 `db/index.ts` 透传，Web 行为不变 | Web 单测全绿，store 不改业务 |
| **P3 SQLite 迁移** | 实现 `SqliteRepository` + 建表/迁移脚本，Android 切换至 SQLite | Android 走 SQLite，数据读写正常 |
| **P4 原生能力** | 接入通知/触感/文件/分享；休息计时器后台通知 | 计时器后台可响，备份文件可分享 |
| **P5 数据迁移与打磨** | 老用户 IndexedDB→SQLite 一次性迁移工具、性能优化、启动屏、应用图标 | 正式发布候选 |

### 老用户数据迁移（P5）

P1 阶段仍用 IndexedDB 的用户，在 P3/P5 升级后需迁移：

1. 首次启动检测到 IndexedDB 存在旧数据 → 读取并 `importAllData` 写入 SQLite。
2. 校验通过后清空 IndexedDB，置迁移完成标记。
3. 失败则保留 IndexedDB，提示用户手动导出备份。

## 12. 测试策略

| 层级 | 工具 | 范围 |
| --- | --- | --- |
| 单元测试 | Vitest（现有） | store / repository 契约测试 |
| 仓储契约 | Vitest + 共享测试套件 | 对 `DexieRepository` 与 `SqliteRepository` 跑同一组断言，保证行为一致 |
| Web E2E | Playwright（现有） | 四页面 + 训练全流程，保持现有快照基线 |
| Android E2E | 手动 + Espresso（后续） | 安装、训练记录、计时器通知、备份导出 |
| 数据校验 | zod schema 复用 | 导入/导出/同步 payload 全部走 `ExportDataSchema` 校验 |

### 验证门槛

- 每阶段必须：`cd pwa && npm run build` 通过。
- Web E2E 100% 通过后才允许推进下一阶段。
- Android 端以真机/模拟器手动走查 + 关键路径截图归档。

## 13. 风险与权衡

| 风险 | 说明 | 应对 |
| --- | --- | --- |
| WebView 兼容差异 | 不同 Android 版本 WebView 行为不一 | 锁定最低 API 24（Android 7.0），CI 覆盖主流版本 |
| SQLite JSON 列查询性能 | 深层嵌套按字段过滤性能弱于关系化 | 仅在顶层索引字段过滤；嵌套查询走内存过滤（数据量可控） |
| 全量快照同步冲突 | 多设备覆盖式同步会丢数据 | 当前明确「以最新快照为准」；未来需要时再上 `sync_queue` 增量同步 |
| 原生通知可靠性 | 后台/Doze 模式下通知延迟 | 使用 `local-notifications` 精确触发，并在前台保留计时器兜底 |
| 迁移失败 | IndexedDB→SQLite 失败 | 保留原数据 + 手动导出兜底，不自动删除 |
| MUI 在 WebView 体积 | 首屏 JS 较大 | 现状可接受；必要时按路由懒加载优化 |

## 14. 与现有架构的关系

- **Web/PWA 不废弃**：仓储抽象后，Web 仍走 Dexie，保持原 PWA 行为与部署。
- **后端不改造**：云端同步契约不变，Fastify + Prisma + PostgreSQL 原样复用。
- **类型契约统一**：`pwa/src/types/index.ts` 的 zod schema 为前后端、Web/Android 共享的唯一数据契约。
- **渐进演进**：先跑通 Capacitor 容器（P1），再逐步替换存储与原生能力，每一步都有可回退的绿基线。

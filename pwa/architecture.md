# VibeFit PWA 架构

## 1. 角色定位

VibeFit PWA 是一个**纯前端 H5/PWA 离线优先应用**，是整个产品的主入口与 UI 承载层：

- 全部训练读写、计划管理、动作库、训练历史均在浏览器本地完成
- 本地数据（Dexie/IndexedDB）为唯一可信源，后端仅作可选云端备份
- 同时作为 Android 应用的 WebView 内嵌资源（详见 [../android/architecture.md](../android/architecture.md)）
- 与后端共享同一份 zod 数据契约，不向后端耦合任何业务逻辑

> 决策背景：后端拆分为独立服务后，PWA 退化为纯前端，承担 UI + 离线存储 + 可选同步。详见 [../docs/architecture-decision.md](../docs/architecture-decision.md)。

## 2. 技术栈

| 层 | 技术 | 版本 | 说明 |
| --- | --- | --- | --- |
| UI 框架 | React | ^19.2.0 | 函数组件 + Hooks |
| 构建工具 | Vite | ^7.3.6 | ESM dev server + 生产打包 |
| UI 库 | MUI | ^7.3.7 | Material 3 风格 |
| 状态管理 | Zustand | ^5.0.11 | 4 个 store，无 Redux |
| 本地 DB | Dexie | ^4.3.0 | IndexedDB 封装 |
| 数据校验 | zod | ^4.3.6 | 与后端共享 schema |
| 路由 | react-router-dom | ^7.18.2 | 嵌套路由 |
| PWA | vite-plugin-pwa | ^1.3.0 | autoUpdate + skipWaiting |
| Android 桥接 | @capacitor/core + 插件 | ^8.5.0 | 通过动态 import 隔离 |
| 测试 | Vitest + Testing Library | ^4.0.18 | `tests/*.test.ts(x)` |
| Lint | ESLint flat config | ^9.39.1 | TS + React Hooks + Refresh |

## 3. 目录结构

```
pwa/
├── src/
│   ├── app/
│   │   ├── theme.ts                # MUI 主题
│   │   └── version.ts              # 应用版本元数据
│   ├── assets/                      # 静态资源
│   ├── components/                  # 复用 UI
│   │   ├── Layout.tsx              # 全局布局 + 路由 Outlet
│   │   ├── ExerciseSelector.tsx
│   │   ├── ExerciseImage.tsx
│   │   ├── LoadingState.tsx
│   │   └── WorkoutArtwork.tsx
│   ├── constants/
│   │   ├── exercises.ts            # 内置动作库
│   │   ├── exerciseAssets.ts       # 动作图片映射
│   │   └── templates.ts            # 计划模板
│   ├── db/
│   │   ├── index.ts                # Dexie 默认导出 + PendingTrainingState 类型
│   │   ├── repository.ts           # DataRepository 接口 + 工厂 + 平台检测
│   │   ├── dexieRepo.ts            # DexieRepository（Web 实现）
│   │   ├── sqliteRepo.ts           # SqliteRepository（Android 实现，动态导入）
│   │   ├── sqliteSchema.ts         # SQLite 建表/迁移 SQL
│   │   └── sqliteSessionMapper.ts  # Session 与 SQLite 行映射
│   ├── domain/                      # 纯领域逻辑（无 React 依赖）
│   │   ├── trainingPlan.ts         # 计划结构 / 生成 / 校验
│   │   ├── trainingContext.ts      # 当前训练上下文计算
│   │   ├── sessionTimer.ts        # 训练/休息计时（时间戳模型）
│   │   ├── cardioMetrics.ts        # 有氧器械指标计算
│   │   └── historyStats.ts         # 历史统计
│   ├── pages/
│   │   ├── Auth/AuthPage.tsx       # 登录页（邮箱验证码）
│   │   ├── Today/
│   │   │   ├── TodayPage.tsx       # 今日训练主页
│   │   │   └── components/
│   │   │       ├── TrainingHeader.tsx
│   │   │       ├── StrengthSection.tsx     # 力量训练区
│   │   │       ├── CardioSection.tsx        # 有氧训练区
│   │   │       ├── ExerciseCard.tsx
│   │   │       ├── TrainingContextCard.tsx
│   │   │       └── SessionRecoveryDialog.tsx # 中断会话恢复
│   │   ├── Plans/PlansPage.tsx      # 计划管理
│   │   ├── History/HistoryPage.tsx  # 训练历史
│   │   └── Settings/SettingsPage.tsx # 设置（含云端同步/备份）
│   ├── services/
│   │   ├── apiClient.ts            # 后端 HTTP 调用（fetch）
│   │   ├── syncService.ts          # 云端备份/恢复
│   │   ├── serverConfig.ts         # API base URL 解析
│   │   ├── nativeBridge.ts         # NativeBridge 接口 + Web fallback
│   │   └── capacitorBridge.ts     # Capacitor 桥接实现（动态导入）
│   ├── stores/
│   │   ├── index.ts                # re-export 4 个 store
│   │   ├── authStore.ts            # JWT / 用户信息 / 登出
│   │   ├── planStore.ts            # 计划 CRUD + 当前计划
│   │   ├── sessionStore.ts         # 训练会话 + 力量/有氧/休息计时
│   │   └── settingsStore.ts        # 应用设置
│   ├── types/index.ts              # zod schema + 派生 TS 类型（前后端共享契约）
│   ├── utils/helpers.ts
│   ├── App.tsx                     # 路由根 + Layout
│   ├── main.tsx                    # 入口：initRepository → ReactDOM render
│   ├── App.css / index.css
├── tests/                          # *.test.ts(x)
├── public/
│   └── icons/icon.svg              # PWA 图标（SVG）
├── scripts/                        # 发布/验收脚本
├── vite.config.ts                  # React + PWA 插件
├── nginx.conf                      # 静态服务 + /api 反代
├── Dockerfile                      # node build → nginx 静态
├── docker-compose.yml              # 仅 frontend :8081
├── docker-bake.hcl                 # 前端镜像多架构
├── eslint.config.js                # flat config
└── package.json
```

## 4. 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                       PWA (浏览器 WebView)                  │
├─────────────────────────────────────────────────────────────┤
│  Pages (Today/Plans/History/Settings/Auth)                  │
│   └─ 复用组件 components/                                   │
├─────────────────────────────────────────────────────────────┤
│  Zustand Stores (auth/plan/session/settings)                │
│   └─ 调用 repository 方法，不直接 import Dexie              │
├─────────────────────────────────────────────────────────────┤
│  DataRepository 接口（src/db/repository.ts）                │
│   ├─ Web/PWA:    DexieRepository  ── Dexie ── IndexedDB    │
│   └─ Android:    SqliteRepository ── Capacitor SQLite      │
│                                                             │
│  NativeBridge 接口（src/services/nativeBridge.ts）         │
│   ├─ Web:       webBridge (no-op fallback)                  │
│   └─ Android:   CapacitorBridge (动态 import)               │
├─────────────────────────────────────────────────────────────┤
│  SyncService（可选）→ apiClient → 后端 /api/backups        │
│  Service Worker（vite-plugin-pwa autoUpdate）              │
└─────────────────────────────────────────────────────────────┘
              │ 仅手动/定时同步（可选）
              ▼
   Fastify 后端（详见 ../backend/architecture.md）
```

## 5. 数据访问层（Repository 抽象）

[db/repository.ts](src/db/repository.ts) 是改造 Android 的**核心枢纽**：上层 store 与组件只依赖 `DataRepository` 接口，对底层 Dexie / SQLite 无感知。

```typescript
export interface DataRepository {
  // 设置
  initDefaultSettings / getSettings / updateSettings
  // 计划
  getAllPlans / getCurrentPlan / addPlan / updatePlan / deletePlan / setCurrentPlan
  // 训练会话
  getAllSessions / getSessionById / getRecentSessions / addSession / updateSession / deleteSession
  // 动作库
  getAllExercises / addExercise / addExercises
  // 未完成训练
  savePendingTraining / getPendingTraining / deletePendingTraining
  // 导入导出 / 清空
  exportAllData / importAllData / clearRemoteSyncState / clearAllData
}
```

### 平台检测与初始化

```typescript
// 通过 window.Capacitor.isNativePlatform() 判断，不静态 import @capacitor/core
export function isNativePlatform(): boolean { ... }

// main.tsx 启动时调用
export async function initRepository(): Promise<DataRepository> {
  if (isNativePlatform()) {
    const { SqliteRepository } = await import('./sqliteRepo');  // 动态 import 隔离
    const repo = new SqliteRepository();
    await repo.init();
    return repo;
  }
  return new DexieRepository();
}
```

**关键设计**：`@capacitor/*` 插件代码不进入 Web 主 bundle，靠 `await import()` 在原生平台才加载。

## 6. 状态管理（Zustand）

[stores/index.ts](src/stores/index.ts) 统一导出 4 个 store：

| Store | 文件 | 职责 |
| --- | --- | --- |
| `useAuthStore` | [authStore.ts](src/stores/authStore.ts) | JWT、用户信息、登出、邮箱验证码登录流程 |
| `usePlanStore` | [planStore.ts](src/stores/planStore.ts) | 计划 CRUD、当前计划切换、计划模板加载 |
| `useSessionStore` | [sessionStore.ts](src/stores/sessionStore.ts) | 训练会话生命周期、力量组记录、有氧计时、休息计时器、未完成会话恢复 |
| `useSettingsStore` | [settingsStore.ts](src/stores/settingsStore.ts) | 重量/距离单位、深色模式、schema 版本 |

### 训练计时关键约束（来自 project_memory）

- 训练时长用 `elapsedSeconds + runningSince` 时间戳模型，`setInterval` 仅刷新 UI
- 休息计时器使用 `RestTimerState`（status/sessionExerciseId/durationSeconds/remainingSeconds/endsAt）
- 有氧训练状态存于 `SessionExercise.cardioRecord`，不在组件本地 state
- 启动/暂停/继续/内容变更/结束必须持久化，外加每 30s checkpoint + `visibilitychange` / `pagehide`
- 24h 内未完成会话不自动删除，通过 `SessionRecoveryDialog` 让用户选择「继续 / 在最后检查点结束 / 丢弃」
- 力量完成一组 → 启动休息计时；有氧与力量切换不丢失训练状态

## 7. 离线优先策略

| 维度 | 策略 |
| --- | --- |
| 可信源 | 本地 Dexie（Web）/ SQLite（Android），唯一真实数据来源 |
| 读写 | 全部走本地，无网络请求 |
| 启动 | `main.tsx` 调用 `initRepository()` → 秒开 |
| 中断恢复 | `pending_training` 表持久化未完成训练，24h 内可恢复 |
| 备份 | 本地导出 JSON + 可选云端快照（`/api/backups`） |
| 冲突 | 当前为「全量快照覆盖」语义，多设备以最新快照为准 |
| 降级 | 无网络/未登录时静默跳过同步，本地功能不受影响 |

## 8. PWA 配置

[vite.config.ts](vite.config.ts) 通过 `vite-plugin-pwa` 配置：

- `registerType: 'autoUpdate'` + `skipWaiting: true` + `clientsClaim: true`：避免缓存旧 JS bundle
- `manifest`：name/short_name/theme_color/display:standalone
- `icons`：使用 SVG（`image/svg+xml` MIME）
- `workbox.globPatterns`：缓存 js/css/html/ico/png/svg

> 硬约束：不手动注册 SW，必须使用插件管理的 SW，否则与 autoUpdate 冲突。

## 9. 路由

[App.tsx](src/App.tsx) 使用 `react-router-dom` v7：

```
/                → TodayPage（默认训练入口）
/plans           → PlansPage
/history         → HistoryPage
/settings        → SettingsPage（含云端备份恢复）
/auth            → AuthPage（未登录跳转）
*                → 重定向到 /
```

全部页面套在 [components/Layout.tsx](src/components/Layout.tsx) 中（顶部导航 + 底部 Tab）。

## 10. 数据契约（前后端共享）

[types/index.ts](src/types/index.ts) 使用 zod 定义全部领域 schema，并 `infer` 出 TypeScript 类型：

- `AppSettingsSchema`
- `TrainingPlanSchema`（含 days/phases/groups/exercises 嵌套）
- `TrainingSessionSchema`（含 exercises/sets/cardioRecord）
- `ExerciseSchema`（动作库）
- `BackupPayloadSchema`（同步到后端的顶层结构）

后端 [backend/src/schemas/backup.ts](../backend/src/schemas/backup.ts) 复用 `BackupPayloadSchema`，确保前后端契约一致。这是 H5 / Android / 后端的唯一共享数据契约。

## 11. NativeBridge 桥接

[services/nativeBridge.ts](src/services/nativeBridge.ts) 定义 `NativeBridge` 接口：

- `scheduleRestTimerNotification(seconds)` / `cancelRestTimerNotification()`
- `hapticLight()` / `hapticMedium()`
- `exportBackupFile(filename, json)` / `importBackupFile()`

Web 平台返回 `webBridge`（全部 no-op / fallback）；Android 通过 `await import('./capacitorBridge')` 动态加载 `CapacitorBridge` 实现，封装 `@capacitor/local-notifications` / `haptics` / `filesystem` / `share`。

## 12. 构建与部署

### 12.1 本地开发

```bash
cd pwa
npm run dev          # Vite dev server :5173
npm run build        # tsc -b && vite build → dist/
npm run test         # vitest run
```

### 12.2 Docker 镜像

[Dockerfile](Dockerfile) 两阶段：

```
node:24-alpine (build)
  └─ npm ci → vite build → /app/dist
nginx:1.29-alpine
  └─ COPY dist → /usr/share/nginx/html
  └─ COPY nginx.conf → /etc/nginx/conf.d/default.conf
  └─ EXPOSE 80
```

[nginx.conf](nginx.conf) 关键点：

- 静态资源 root `/usr/share/nginx/html`
- `/api/*` 反代到 upstream `backend`（Docker DNS 解析，避免启动期 DNS 失败）
- `/healthz` `/readyz` `/health` 一并暴露
- SPA fallback：所有未匹配路径返回 `index.html`

### 12.3 部署形态

- 本地：`docker-compose.yml` 仅编排 `frontend` 容器（:8081）
- 生产：由运维通过 `docker-compose.override.yml` 引用 `pwa/scripts/images.lock.env` 中的 ACR 镜像 digest，仓库不为特定部署目标维护专用目录
- 多架构：[docker-bake.hcl](docker-bake.hcl) 支持 AMD64 + ARM64
- 发布：[scripts/publish-acr.sh](scripts/publish-acr.sh) 推 ACR
- 验收：[scripts/acceptance.sh](scripts/acceptance.sh) 检查容器状态、HTTP 200、SPA fallback、Service Worker 资源

## 13. 测试策略

- 单测：`tests/*.test.ts(x)`，纯 TS 用 Node 环境，需 DOM 的文件头声明 `@vitest-environment jsdom`
- 覆盖：store 行为、计时器逻辑、有氧/力量状态切换、计划生成、备份 payload 校验
- 命令门槛：`npm run build` + `npm test` 必须全绿

## 14. 开发约束（来自 project_memory）

- `deleteDatabase()` 必须由 `import.meta.env.DEV` 守卫；生产用 `clearAllData()` + 确认流
- 有氧草稿在 `pagehide` / `visibilitychange:hidden` / 完成记录 / 结束训练时立即持久化，debounce 必须取消
- 同一时刻最多一个有氧动作运行；开始新有氧前需完成或暂停当前有氧
- 力量休息秒数取自 `PlanExerciseConfig.restSeconds` → `SessionExercise.restSeconds` → `DEFAULT_STRENGTH_REST_SECONDS` 兜底
- 训练计时与单次有氧计时区分：整场训练累计 vs 单器械运行时间
- 暂停单个有氧器械不应自动暂停整场训练

## 15. 相关文档

- [README.md](README.md) — 快速开始
- [../docs/architecture-decision.md](../docs/architecture-decision.md) — 后端拆分决策
- [../backend/architecture.md](../backend/architecture.md) — 后端架构
- [../android/architecture.md](../android/architecture.md) — Android 架构
- [../android/docs/android-architecture.md](../android/docs/android-architecture.md) — Android 详细设计（P1-P5 阶段）

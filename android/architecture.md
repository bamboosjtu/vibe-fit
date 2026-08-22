# VibeFit Android 架构

## 1. 角色定位

VibeFit Android 是基于 **Capacitor 8** 封装 PWA 构建产物的离线安卓应用：

- 复用 `pwa/dist` 全部 React 前端代码与 UI，不重写业务逻辑
- 本地存储切换为 SQLite（`@capacitor-community/sqlite`），通过仓储抽象让上层无感知
- 增加原生能力：本地通知、触感反馈、文件系统、分享、启动屏
- 云端备份能力沿用 PWA 的后端契约，不改后端

> 本文件为 Android 模块入口架构文档。深度设计（含 P1-P5 渐进演进路径、迁移脚本、风险与权衡）见 [docs/android-architecture.md](docs/android-architecture.md)。

## 2. 技术栈

| 层 | 技术 | 版本 | 说明 |
| --- | --- | --- | --- |
| 原生壳 | Capacitor | ^8.5.0 | WebView + 插件桥接 |
| 本地 DB | @capacitor-community/sqlite | ^8.1.0 | 替代 IndexedDB 作可信源 |
| 本地通知 | @capacitor/local-notifications | ^8.2.0 | 休息计时器后台响铃 |
| 触感 | @capacitor/haptics | ^8.0.0 | 完成组/结束训练反馈 |
| 文件 | @capacitor/filesystem | ^8.1.0 | 备份文件导入导出 |
| 分享 | @capacitor/share | ^8.0.0 | 系统分享面板 |
| 偏好 | @capacitor/preferences | ^8.0.0 | 设备级配置 |
| 启动屏 | @capacitor/splash-screen | ^8.0.0 | 原生启动屏 |
| UI / 业务 | React 19 + MUI 7 + Zustand 5 + zod 4 | — | 复用 `pwa/` 源码 |
| 构建 | Vite 7 → Capacitor sync → Gradle | — | APK / AAB |
| appId | `com.vibefit.app` | — | — |

完整依赖见 [package.json](package.json)。

## 3. 目录结构

```
android/
├── capacitor.config.ts             # Capacitor 配置：appId / webDir / 插件配置
├── package.json                    # Capacitor 8 依赖与脚本
├── docs/
│   └── android-architecture.md    # 详细设计文档（P1-P5 阶段、SQLite schema、迁移路径）
├── android/                         # 原生 Android Studio 工程（cap add android 生成，已 gitignore）
│   └── app/
│       ├── src/main/AndroidManifest.xml
│       └── build.gradle
└── README.md
```

> 仓库根的 `pwa/src/db/sqliteSchema.ts`、`pwa/src/db/sqliteRepo.ts`、`pwa/src/services/nativeBridge.ts`、`pwa/src/services/capacitorBridge.ts` 是 Android 专属的共享数据层骨架，刻意放在 `pwa/` 内以便与 Dexie 实现共享类型。

## 4. 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                   Android App (APK/AAB)                     │
├─────────────────────────────────────────────────────────────┤
│  Native Shell (Capacitor 8)                                 │
│   ├── WebView ── 加载打包进 APK 的 pwa/dist React 静态资源   │
│   └── Native Plugins                                       │
│        ├── SQLite               本地数据库                  │
│        ├── Local Notifications  休息计时 / 训练提醒          │
│        ├── Haptics              完成组/动作触感反馈         │
│        ├── Filesystem           导出/导入备份文件           │
│        ├── Preferences          设备级配置                  │
│        ├── Share                系统分享面板                │
│        └── SplashScreen         原生启动屏                  │
├─────────────────────────────────────────────────────────────┤
│  Web Layer（pwa/dist，嵌入 WebView）                         │
│   ├── Pages / Components       React 19 + MUI 7              │
│   ├── Stores                   Zustand（auth/plan/session/settings）│
│   ├── Data Access Layer        DataRepository 接口           │
│   │   ├── DexieRepository       （Web/PWA 实现，不加载）     │
│   │   └── SqliteRepository      （Android 实现，动态 import）│
│   ├── NativeBridge             接口 + CapacitorBridge 实现   │
│   ├── Sync Service             可选云端快照同步             │
│   └── Types / Schemas          zod（与后端共享契约）         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ （可选，手动/定时）
┌─────────────────────────────────────────────────────────────┐
│  后端：Fastify + Prisma + PostgreSQL                        │
│  仅 POST /api/backups、GET /api/backups/latest              │
└─────────────────────────────────────────────────────────────┘
```

## 5. Capacitor 配置

[capacitor.config.ts](capacitor.config.ts) 关键字段：

```typescript
const config: CapacitorConfig = {
  appId: 'com.vibefit.app',
  appName: 'VibeFit',
  webDir: '../pwa/dist',                  // 复用 pwa 构建产物
  server: { androidScheme: 'https' },     // WebView 内使用 https 协议
  plugins: {
    SplashScreen: {                       // 启动屏：与 res/values/colors.xml colorPrimary 一致
      launchShowDuration: 1000,
      backgroundColor: '#05A978',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_launcher',
      iconColor: '#05A978',
    },
  },
};
```

## 6. 与 PWA 的关系

| 维度 | PWA | Android |
| --- | --- | --- |
| UI 代码 | 源 | 复用（打包进 APK） |
| 业务逻辑（stores/domain） | 源 | 复用 |
| 数据契约（zod schema） | 源 | 复用 |
| 本地 DB | Dexie / IndexedDB | SQLite（@capacitor-community/sqlite） |
| 数据访问 | `DexieRepository` | `SqliteRepository` |
| 原生能力 | 无（Web fallback no-op） | Capacitor 插件 |
| 同步后端 | 复用 | 复用 |
| 路由 | react-router | 同 |
| 部署 | nginx 静态 | APK / AAB |

**关键设计**：

- `pwa/src/db/repository.ts` 通过 `isNativePlatform()`（检测 `window.Capacitor`）选择实现
- `SqliteRepository` 与 `CapacitorBridge` 通过 `await import()` 动态加载，**保证 `@capacitor/*` 不进入 Web 主 bundle**
- 业务代码（stores/components/domain）零分支判断平台，全部通过接口多态

## 7. 本地数据库（SQLite）

详细 schema 与迁移策略见 [docs/android-architecture.md](docs/android-architecture.md) 第 4 节。要点：

- 数据库文件：`vibefit.db`，schema 版本从 1 起步
- **混合模型**：顶层实体（plans/sessions/exercises/settings/pending_training/sync_meta/sync_queue）为独立表 + 索引，嵌套结构（days/phases/groups、exercises/sets）存 JSON 列
- 与 `pwa/src/types/index.ts` 的 zod schema 一一对应
- 启动校验 `PRAGMA user_version`，按需执行增量迁移
- 老用户从 IndexedDB → SQLite 的一次性迁移工具在 P5 阶段实现

## 8. 原生能力集成

| 能力 | 插件 | 用途 |
| --- | --- | --- |
| 本地通知 | `@capacitor/local-notifications` | 休息计时到点、训练提醒，App 后台/锁屏可响 |
| 触感反馈 | `@capacitor/haptics` | 完成组、结束训练轻震动 |
| 文件系统 | `@capacitor/filesystem` | 导出/导入 JSON 备份文件 |
| 分享 | `@capacitor/share` | 调起系统分享发送备份文件 |
| 偏好存储 | `@capacitor/preferences` | 设备级配置（如 deviceId） |
| 启动屏 | `@capacitor/splash-screen` | 原生启动屏 |

**休息计时器关键改造**：PWA 的 `setInterval` 在前台递减；Android 上计时启动时同步注册 Local Notification，到点触发，保证后台/锁屏可提示。

## 9. 离线优先策略

| 维度 | 策略 |
| --- | --- |
| 可信源 | 本地 SQLite，唯一真实数据来源 |
| 读写 | 全部走本地，无网络请求 |
| 启动 | App 打开即读本地 SQLite，秒开 |
| 中断恢复 | `pending_training` 表持久化未完成训练，沿用 PWA 24h 内恢复逻辑 |
| 备份 | 本地文件导出（Filesystem + Share）+ 可选云端快照 |
| 冲突 | 当前为「全量快照覆盖」语义，多设备以最新快照为准 |

## 10. 构建与发布

### 开发流程

```bash
cd android

# 1. 构建 PWA 前端并同步到原生工程（产物到 ../pwa/dist）
npm run sync

# 2. Android Studio 打开原生工程调试 / 运行
npm run open
```

`npm run sync` = `npm run build:web`（即 `npm --prefix ../pwa run build`）+ `cap sync android`。

### 发布产物

- `./gradlew assembleRelease` → 签名 APK（sideload）
- `./gradlew bundleRelease` → 签名 AAB（Play Store）
- 签名 keystore 纳入密钥管理，不提交仓库

### CI/CD（后续阶段）

- 流水线：`npm run build → cap sync → gradle bundleRelease → 上传`
- 前端单测（Vitest）必须保持绿基线，Android 产物在 CI 中产出

## 11. 渐进演进路径

详细分阶段计划见 [docs/android-architecture.md](docs/android-architecture.md) 第 11 节：

| 阶段 | 目标 | 产物 |
| --- | --- | --- |
| **P1 容器化** | 接入 Capacitor，先用 IndexedDB 跑通 | 可安装 APK，四页面可用 |
| **P2 仓储抽象** | 引入 `DataRepository` 接口，Web 行为不变 | Web 单测全绿，store 不改业务 |
| **P3 SQLite 迁移** | 实现 `SqliteRepository` + 建表/迁移脚本 | Android 走 SQLite，读写正常 |
| **P4 原生能力** | 接入通知/触感/文件/分享；计时器后台通知 | 计时器后台可响，备份可分享 |
| **P5 数据迁移与打磨** | 老用户 IndexedDB→SQLite 迁移工具、启动屏、应用图标 | 正式发布候选 |

**验证门槛**：每阶段必须 `cd pwa && npm run build` 通过；Web E2E 100% 通过后才允许推进下一阶段；Android 端以真机/模拟器手动走查 + 关键路径截图归档。

## 12. 测试策略

| 层级 | 工具 | 范围 |
| --- | --- | --- |
| 单元测试 | Vitest（现有 PWA 测试） | store / repository 契约 |
| 仓储契约 | Vitest + 共享测试套件 | `DexieRepository` 与 `SqliteRepository` 跑同一组断言 |
| Web E2E | Playwright（现有） | 四页面 + 训练全流程 |
| Android E2E | 手动 + Espresso（后续） | 安装、训练记录、计时器通知、备份导出 |
| 数据校验 | zod schema 复用 | 导入/导出/同步 payload 全部走 `BackupPayloadSchema` |

## 13. 相关文档

- [README.md](README.md) — 模块说明
- [docs/android-architecture.md](docs/android-architecture.md) — 详细设计（背景、技术选型对比、SQLite schema、迁移路径、风险与权衡）
- [../docs/architecture-decision.md](../docs/architecture-decision.md) — 后端拆分决策
- [../pwa/architecture.md](../pwa/architecture.md) — PWA 架构（被复用的源）
- [../backend/architecture.md](../backend/architecture.md) — 后端架构（云端备份服务）

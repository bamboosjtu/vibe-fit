# VibeFit Android

VibeFit 安卓离线版，基于 **Capacitor 8** 封装 `pwa/frontend` 构建产物，提供本地 SQLite 存储与原生能力。

架构设计见 [docs/android-architecture.md](./docs/android-architecture.md)。

## 目录结构

```
android/
├── capacitor.config.ts        # Capacitor 配置（webDir 指向 ../pwa/frontend/dist）
├── package.json               # Capacitor 依赖与脚本
├── android/                   # 原生 Android Studio 工程（cap add android 生成，已 gitignore）
└── docs/
    └── android-architecture.md
```

> 原生工程目录名为 `android/android/`（Capacitor 平台目录约定），已加入 `.gitignore`，由 `cap add android` 首次生成。

## 前置要求

- Node.js >= 20
- Android Studio（含 Android SDK，最低 API 24 / Android 7.0）
- Java JDK 17（Android Gradle Plugin 8 要求）

## 首次初始化

```bash
cd android
npm install

# 生成原生 Android 工程（创建 android/android/）
npx cap add android
```

## 日常开发流程

```bash
# 1. 构建 PWA 前端并同步到原生工程
npm run sync

# 2. 用 Android Studio 打开原生工程调试 / 运行
npm run open
```

## 构建发布

在 Android Studio 中或用 Gradle：

```bash
cd android/android
./gradlew assembleRelease   # 产物：apk
./gradlew bundleRelease     # 产物：aab（Play Store）
```

签名 keystore 不要提交到仓库。

## 数据层说明

前端数据访问已抽象为 `DataRepository`（位于 `pwa/frontend/src/db/repository.ts`）：

- Web/PWA：`DexieRepository`（IndexedDB）
- Android：`SqliteRepository`（`@capacitor-community/sqlite`）

运行时由 `Capacitor.isNativePlatform()` 自动选择实现，上层 store 与组件无需改动。SQLite 建表脚本见 `pwa/frontend/src/db/sqliteSchema.ts`。

## 原生能力

| 能力 | 插件 | 状态 |
| --- | --- | --- |
| 本地数据库 | `@capacitor-community/sqlite` | 已接入依赖，SqliteRepository 待实现 |
| 本地通知 | `@capacitor/local-notifications` | 休息计时器后台通知（待实现） |
| 触感反馈 | `@capacitor/haptics` | 待实现 |
| 文件系统 | `@capacitor/filesystem` | 备份导入导出（待实现） |
| 分享 | `@capacitor/share` | 待实现 |
| 偏好存储 | `@capacitor/preferences` | 待实现 |
| 启动屏 | `@capacitor/splash-screen` | 已配置 |

实现进度对应 [android-architecture.md](./docs/android-architecture.md) 的 P1–P5 阶段。

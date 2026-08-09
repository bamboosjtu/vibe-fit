# VibeFit Android

VibeFit 安卓离线版，基于 **Capacitor 8** 封装 `pwa/frontend` 构建产物，提供本地 SQLite 存储与原生能力。

架构设计见 [docs/android-architecture.md](./docs/android-architecture.md)。

## 目录结构

```
android/
├── capacitor.config.ts        # Capacitor 配置（webDir 指向 ../pwa/frontend/dist）
├── package.json               # Capacitor 依赖与脚本
├── android/                   # 已纳入版本管理的原生 Android Studio 工程
└── docs/
    └── android-architecture.md
```

> 原生工程目录名为 `android/android/`（Capacitor 平台目录约定）。不要再次运行 `cap add android` 覆盖现有原生配置。

## 前置要求

- Node.js 24
- Android Studio（含 Android SDK，最低 API 24 / Android 7.0）
- Java JDK 21（Capacitor 8 当前 Android 工程的编译 toolchain）

## 首次初始化

```bash
cd android
npm install

# 原生工程已存在，只需同步插件和 Web 资源
npm run sync
```

## 日常开发流程

```bash
# 1. 构建 PWA 前端并同步到原生工程
npm run sync

# 2. 用 Android Studio 打开原生工程调试 / 运行
npm run open
```

## 构建发布

`1.1.0`（`versionCode 83`）要求在构建时提供 VibeFit 私有根 CA 公钥；根私钥不得进入构建机或仓库：

```powershell
$env:VIBEFIT_CA_CERT_PATH = "C:\secure\vibefit-root-ca.pem"
```

在 Android Studio 中或用 Gradle：

```bash
cd android/android
./gradlew assembleRelease   # 产物：apk
./gradlew bundleRelease     # 产物：aab（Play Store）
```

签名 keystore 不要提交到仓库。

应用禁止明文 HTTP，只信任系统 CA 与该内置根 CA。首次启动未配置服务器时，会先要求填写并测试 HTTPS origin；设置页可切换服务器。切换会退出远端账户并清理同步队列/元数据，但保留全部本地训练数据。

## 数据层说明

前端数据访问已抽象为 `DataRepository`（位于 `pwa/frontend/src/db/repository.ts`）：

- Web/PWA：`DexieRepository`（IndexedDB）
- Android：`SqliteRepository`（`@capacitor-community/sqlite`）

运行时由 `Capacitor.isNativePlatform()` 自动选择实现，上层 store 与组件无需改动。SQLite 建表脚本见 `pwa/frontend/src/db/sqliteSchema.ts`。

## 原生能力

| 能力 | 插件 | 状态 |
| --- | --- | --- |
| 本地数据库 | `@capacitor-community/sqlite` | 已实现 |
| 本地通知 | `@capacitor/local-notifications` | 休息计时器后台通知（待实现） |
| 触感反馈 | `@capacitor/haptics` | 待实现 |
| 文件系统 | `@capacitor/filesystem` | 备份导入导出（待实现） |
| 分享 | `@capacitor/share` | 待实现 |
| 偏好存储 | `@capacitor/preferences` | 已用于家庭服务器 origin |
| 启动屏 | `@capacitor/splash-screen` | 已配置 |

实现进度对应 [android-architecture.md](./docs/android-architecture.md) 的 P1–P5 阶段。

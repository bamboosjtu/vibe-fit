# Android 平台说明

VibeFit Android 是基于 Capacitor 8 封装 `pwa/` 构建产物的离线应用，原生工程位于 `android/android/`（由 `cap add android` 生成，已 gitignore）。架构细节见 `android/docs/android-architecture.md`。后端独立部署在 `backend/`，作为 Android 与 PWA 的共同云端备份服务。

## Capacitor 封装

- 复用 `pwa/dist` 构建产物，通过 `npx cap copy android` 同步到原生工程；
- 不 fork 前端代码，平台差异通过 `pwa/src/services/nativeBridge.ts` 桥接；
- 升级前端依赖时同步检查 Capacitor 插件版本兼容性。

## 本地 SQLite

- 训练数据在 Android 端写入本地 SQLite，schema 与 `pwa/src/db/sqliteSchema.ts` 对齐；
- 共享数据层骨架在 `pwa/src/db/repository.ts`，仓储实现按平台切换；
- 不引入云端依赖即可完整记录训练。

## 原生能力

- 计时：标签页隐藏时通过原生通知/前台服务保持计时准确，回前台用时间戳校准 `runningSince`；
- 振动：完成组、休息结束可触发原生振动反馈（可选）；
- 存储：动作资源 PNG 走 Capacitor WebView 静态路径，与 PWA 一致；
- 不申请非必要权限；不收集设备标识。

## 与 PWA 的差异

- 数据存储：SQLite 替代 IndexedDB；
- 离线：原生离线，无 SW；
- 后台：原生能力保持计时，PWA 依赖时间戳校准；
- 部署：打包 APK，不走 Docker，详见 [`pwa.md`](./pwa.md) 对照。

# PWA 平台说明

VibeFit 的 Web/PWA 构建产物来自 `pwa/frontend`，通过本地 Docker 或 GCP 部署，详见 `pwa/docs/deployment.md` 与 `pwa/docs/gcloud.md`。

## 部署

- 本地：`pwa/docker-compose.yml` 拉起 postgres + migrate + backend + worker + frontend；
- 生产：静态资源由 frontend 容器或 CDN 托管，后端 Fastify 提供 `/api` 与可选云端备份；
- 前端构建命令遵循 `pwa/frontend/package.json`，输出到 `dist/`。

## Service Worker

- 使用 Vite PWA 插件生成 SW，预缓存应用壳与静态资源；
- 训练数据走 Dexie/IndexedDB，不依赖网络，离线可记录；
- SW 更新策略：检测到新版本时提示用户刷新，不强制接管；
- 静态资源（含 `/assets/exercises/*.png`）走缓存优先，网络回退。

## HTTPS

- 生产必须 HTTPS，否则 Service Worker、IndexedDB 部分能力受限；
- 本地开发可用 `vite` 自带 HTTP，Docker 部署通过反向代理终结 TLS；
- 不在代码中硬编码证书路径，统一走环境变量与 `pwa/backend/.env.example` 模板。

## 与 Android 的关系

PWA 是 Android (Capacitor) 的代码来源，两者共用 `pwa/frontend`，差异通过 `pwa/frontend/src/services/nativeBridge.ts` 抽象，详见 [`android.md`](./android.md)。

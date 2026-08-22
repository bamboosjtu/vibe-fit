# PWA 平台说明

VibeFit 的 Web/PWA 构建产物来自 `pwa/`（纯前端，离线优先），通过本地 Docker 部署。后端独立部署在 `backend/`，作为 PWA 与 Android 的共同云端备份服务，详见 [`../../backend/docs/deployment.md`](../../backend/docs/deployment.md)（本地）与 [`../../docs/deployment-architecture.md`](../../docs/deployment-architecture.md)（跨端部署架构）。

## 部署

- 本地前端栈：`pwa/docker-compose.yml` 仅拉起 `frontend`（nginx + 构建产物 + SW），`:8081`，**不依赖 backend 容器**；
- 本地后端联调：另起 `backend/docker-compose.yml`（postgres + backend + worker，`:8080`）；
- 生产：静态资源由 `vibefit-frontend` 容器或 CDN 托管，后端 Fastify 提供 `/api` 与可选云端备份；生产部署由运维通过 `docker-compose.override.yml` 引用 ACR 镜像 digest 编排，仓库不为特定目标维护专用目录；
- 前端构建命令遵循 `pwa/package.json`，输出到 `pwa/dist/`。

## Service Worker

- 使用 Vite PWA 插件生成 SW，预缓存应用壳与静态资源；
- 训练数据走 Dexie/IndexedDB，不依赖网络，离线可记录；
- SW 更新策略：检测到新版本时提示用户刷新，不强制接管；
- 静态资源（含 `/assets/exercises/*.png`）走缓存优先，网络回退。

## HTTPS

- 生产必须 HTTPS，否则 Service Worker、IndexedDB 部分能力受限；
- 本地开发可用 `vite` 自带 HTTP，Docker 部署通过反向代理终结 TLS；
- 不在代码中硬编码证书路径，统一走环境变量与 `backend/.env.example` 模板。

## 与 Android 的关系

PWA 是 Android (Capacitor) 的代码来源，两者共用 `pwa/` 构建产物（`pwa/dist`），差异通过 `pwa/src/services/nativeBridge.ts` 抽象，详见 [`android.md`](./android.md)。后端 API 契约不变，Android 与 PWA 调用同一组 `backend/` 端点完成可选云端备份。

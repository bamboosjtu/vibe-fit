# 仓库开发规范

## 项目结构与模块组织

VibeFit 是一个健身应用，仓库产出四个顶层目录：

- `pwa/`：纯前端 H5/PWA 应用（React 19 + Vite），离线优先。本地数据使用 Dexie（IndexedDB）作为唯一可信源。
  - 页面在 `src/pages/`，可复用 UI 在 `src/components/`，store 在 `src/stores/`，service 在 `src/services/`，资源在 `src/assets/` 或 `public/`。
  - `Dockerfile` 多阶段构建：node 编译 + nginx 静态服务 + vite-plugin-pwa 生成的 Service Worker。
  - `docker-compose.yml` 仅编排前端容器；`docker-bake.hcl` 多架构构建 frontend 镜像；`scripts/` 含发布与验收。
  - 不依赖 backend 容器；nginx 反代 `/api/*` 到 upstream `backend`，若未启动 backend 仅云端备份失败，本地功能不受影响。
- `backend/`：Fastify + TypeScript 后端 API，作为 PWA 与 Android 的共同云端备份服务。平台无关，无 `if android/web` 分支。
  - 路由在 `src/routes/`，仓储在 `src/repositories/`，事件在 `src/events/`，Prisma 在 `prisma/`。
  - `Dockerfile` 多阶段构建，产出 `api-runtime` 与 `worker-runtime` 两个独立 target。
  - `docker-compose.yml` 编排 postgres + migrate + backend + worker；`docker-bake.hcl` 多架构构建 backend/worker/maintenance/postgres/caddy 镜像。
  - `cloudbuild.publish.yaml` 与 `cloudbuild.deploy-gcp.yaml` 为 GCP 可选方案。
  - `deploy/rpi/` 是树莓派一体化部署套件（compose/scripts/systemd/maintenance），跨 backend + frontend 编排（frontend 镜像通过 `FRONTEND_IMAGE` 引用）。
  - `docs/` 含后端开发/部署/运维文档（development.md / deployment.md / gcloud.md / raspberry-pi.md / rpi-30-day-validation.md / 树莓派部署计划.md）。
- `android/`：Android 离线应用，基于 Capacitor 8 封装 `pwa/` 构建产物，增加本地 SQLite 与原生能力。原生工程位于 `android/android/`（由 `cap add android` 生成，已 gitignore）。见 `android/docs/android-architecture.md`。
- `docs/`：跨端共享文档（UI 设计、平台说明、数据契约、架构决策）。
  - `architecture-decision.md` 记录后端独立为单独服务的决策与模块化约束（前后端、Web/Android 共享的唯一 zod 数据契约）。
- 共享数据层骨架位于 `pwa/src/db/`（`repository.ts`、`sqliteSchema.ts`）与 `pwa/src/services/nativeBridge.ts`。

## 编码风格与命名约定

全程使用 TypeScript。采用两空格缩进，变量/函数用 `camelCase`，React 组件与类型用 `PascalCase`，文件名需具描述性，如 `TrainingHeader.tsx` 或 `pubsubPublisher.ts`。路由处理器、仓储与 UI 组件保持在其现有目录中。前端 lint 使用 ESLint flat config，包含 TypeScript、React Hooks 与 React Refresh 规则。

## 测试规范

前端测试使用 Vitest 与 Testing Library，位于 `pwa/tests/`，使用 `*.test.ts` 或 `*.test.tsx`。纯 TypeScript 测试默认使用 Node 环境，需要 DOM 的 `*.test.tsx` 在文件头显式声明 `@vitest-environment jsdom`。后端测试位于 `backend/tests/`；改动后端行为前先运行 `npm run typecheck` 与 `npm run build`。

## 提交与 Pull Request 规范

近期历史使用简短主题，有时带 `docs:`、`bugfix:` 等前缀，有时是中文摘要。保持提交聚焦且具描述性，例如 `docs: update deployment runbook`。Pull Request 应包含摘要、受影响区域（`frontend`、`backend`、`docs` 或 infra）、测试结果、相关 issue 链接，以及可见 UI 改动的截图。

## 安全与配置提示

不要提交密钥。以 `backend/.env.example` 作为后端配置模板，真实值放在 `backend/.env`（本地开发）或 `backend/docker-compose.yml` 的 environment 段（本地 Docker）。前端构建期变量参考 `pwa/.env.example`。数据库改动时，更新 `backend/prisma/schema.prisma`，创建迁移，并在必要时在 `backend/docs/` 记录运维影响。

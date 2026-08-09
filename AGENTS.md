# 仓库开发规范

## 项目结构与模块组织

VibeFit 是一个健身应用，同一仓库产出两个构建目标：

- `pwa/`：Web/PWA 应用（前端 + 后端），通过本地 Docker 部署。
  - `pwa/frontend/`：React 19 + Vite 应用。页面在 `src/pages/`，可复用 UI 在 `src/components/`，store 在 `src/stores/`，service 在 `src/services/`，资源在 `src/assets/` 或 `public/`。本地数据使用 Dexie（IndexedDB）。
  - `pwa/backend/`：Fastify + TypeScript API。路由在 `src/routes/`，仓储在 `src/repositories/`，事件在 `src/events/`，Prisma 在 `prisma/`。仅用于可选的云端备份。
  - `pwa/docker-compose.yml`：本地 Docker 部署（postgres + migrate + backend + worker + frontend）。见 `pwa/docs/deployment.md`。
  - `pwa/docs/`：PWA 实现文档（development.md 开发指南、deployment.md 本地部署、gcloud.md 可选 GCP 部署）。
- `android/`：Android 离线应用，基于 Capacitor 8 封装 `pwa/frontend`，增加本地 SQLite 与原生能力。原生工程位于 `android/android/`（由 `cap add android` 生成，已 gitignore）。见 `android/docs/android-architecture.md`。
- `docs/`：跨端共享的 UI 设计（如 `原型图.png`）。
- 共享数据层骨架位于 `pwa/frontend/src/db/`（`repository.ts`、`sqliteSchema.ts`）与 `pwa/frontend/src/services/nativeBridge.ts`。

## 编码风格与命名约定

全程使用 TypeScript。采用两空格缩进，变量/函数用 `camelCase`，React 组件与类型用 `PascalCase`，文件名需具描述性，如 `TrainingHeader.tsx` 或 `pubsubPublisher.ts`。路由处理器、仓储与 UI 组件保持在其现有目录中。前端 lint 使用 ESLint flat config，包含 TypeScript、React Hooks 与 React Refresh 规则。

## 测试规范

前端测试使用 Vitest 与 Testing Library。纯 TypeScript 测试默认使用 Node 环境，需要 DOM 的 `*.test.tsx` 在文件头显式声明 `@vitest-environment jsdom`。测试放在 `pwa/frontend/tests/`，使用 `*.test.ts` 或 `*.test.tsx`，与当前 Vitest include 模式一致。后端暂未配置测试；改动后端行为前先运行 `npm run typecheck` 与 `npm run build`。

## 提交与 Pull Request 规范

近期历史使用简短主题，有时带 `docs:`、`bugfix:` 等前缀，有时是中文摘要。保持提交聚焦且具描述性，例如 `docs: update deployment runbook`。Pull Request 应包含摘要、受影响区域（`frontend`、`backend`、`docs` 或 infra）、测试结果、相关 issue 链接，以及可见 UI 改动的截图。

## 安全与配置提示

不要提交密钥。以 `pwa/backend/.env.example` 作为本地配置模板，真实值放在 `.env`（本地开发）或 `pwa/docker-compose.yml` 的 environment 段（本地 Docker）。数据库改动时，更新 `pwa/backend/prisma/schema.prisma`，创建迁移，并在必要时在 `pwa/docs/` 记录运维影响。

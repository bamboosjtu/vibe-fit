# VibeFit PWA（纯前端 H5，离线优先）

VibeFit 的 Web/PWA 构建，基于 React 19 + Vite 7。本地数据使用 Dexie（IndexedDB）作为唯一可信源，无网络也能完整使用全部功能。后端独立部署在 [`../backend/`](../backend/)，作为 PWA 与 Android 的共同云端备份服务（可选）。

跨端共享文档见 [`../docs/`](../docs/)；Android 工程见 [`../android/`](../android/)。

## 目录结构

```
pwa/
├── src/
│   ├── app/                    # theme、version
│   ├── assets/                 # React 静态资源
│   ├── components/             # 可复用 UI 组件
│   ├── constants/              # 动作库、模板、资源映射
│   ├── db/                     # 数据访问层（repository 抽象 + Dexie + SQLite schema）
│   ├── domain/                 # 业务域（训练上下文、计时器、统计）
│   ├── pages/                  # 页面（Today / Plans / History / Settings / Auth）
│   ├── services/               # API client、原生能力桥接、同步服务
│   ├── stores/                 # Zustand stores（plan / session / settings / auth）
│   ├── types/                  # zod 数据契约（前后端共享）
│   └── utils/
├── public/
│   ├── assets/exercises/       # 动作示意图 PNG
│   └── icons/                  # PWA 图标
├── tests/                      # Vitest 单测
├── scripts/                    # 镜像发布 + 部署验收
├── Dockerfile                  # 多阶段构建：node 编译 + nginx 静态服务
├── docker-compose.yml          # 本地前端容器栈（仅 frontend :8081）
├── docker-bake.hcl             # 前端镜像多架构构建编排
├── nginx.conf                  # nginx 配置（SPA fallback + /api/* 反代）
├── vite.config.ts              # Vite + Vite PWA 配置
├── vitest.config.ts            # Vitest 配置
├── eslint.config.js            # ESLint flat config
└── package.json
```

## 本地开发

```bash
cd pwa
npm install
npm run dev          # http://localhost:5173
```

## 构建与测试

```bash
npm run build        # tsc -b + vite build（产物到 dist/）
npm run lint         # ESLint
npm test             # Vitest
```

## Docker 部署

```bash
cd pwa
docker compose up -d --build    # http://localhost:8081
sh scripts/acceptance.sh        # 部署验收
```

PWA 是纯前端离线应用，不依赖 backend 容器。nginx 通过同源 `/api/*` 反代到 upstream `backend`，若未启动 backend 仅云端备份失败，本地功能不受影响。需要联调后端时另起 `../backend/docker-compose.yml`。

## 镜像发布

```bash
docker buildx bake --file docker-bake.hcl --push
```

发布入口 `scripts/publish-acr.sh`；多架构构建（linux/amd64 + linux/arm64）产出 `vibefit-frontend` 镜像。后端镜像由 `../backend/docker-bake.hcl` 单独构建，避免跨端耦合。

## 关键约束

- **离线优先**：本地 Dexie/IndexedDB 是唯一可信源，所有读写走本地，不依赖网络。
- **数据契约**：`src/types/index.ts` 的 zod schema 是前后端、Web/Android 共享的唯一数据契约。
- **平台无关**：UI 层不写 `if web / if android` 分支；原生能力通过 `src/services/nativeBridge.ts` 抽象，Android 端由 `src/services/capacitorBridge.ts` 实现。
- **数据访问层**：`src/db/repository.ts` 定义 `DataRepository` 接口，Web 用 `DexieRepository`，Android 用 `SqliteRepository`（见 `src/db/sqliteRepo.ts`），运行时由 `Capacitor.isNativePlatform()` 自动选择。
- **训练计时**：基于时间戳（`elapsedSeconds + runningSince`），`setInterval` 仅用于 UI 重绘。
- **Service Worker**：使用 `vite-plugin-pwa` 的 `autoUpdate` + `skipWaiting` + `clientsClaim`，避免缓存旧 JS bundle。
- **生产环境**：禁止 `deleteDatabase()`；使用 `clearAllData()` + 确认流程，仅在 `import.meta.env.DEV` 下允许 `deleteDatabase()`。

## 关联文档

- 后端开发与部署：[`../backend/docs/`](../backend/docs/)
- 跨端架构决策：[`../docs/architecture-decision.md`](../docs/architecture-decision.md)
- PWA 平台说明：[`../docs/platforms/pwa.md`](../docs/platforms/pwa.md)
- 今日训练 UI Brief：[`../docs/ui/today/ui-brief.md`](../docs/ui/today/ui-brief.md)
- 设计系统：[`../docs/design-system.md`](../docs/design-system.md)
- 仓库规范：[`../AGENTS.md`](../AGENTS.md)

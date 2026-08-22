<div align="center">

# VibeFit 💪

**移动端优先的离线健身训练计划与记录工具**

一套前端代码，两个构建目标：PWA（纯前端 H5，离线优先）+ Android（Capacitor 离线原生应用）；后端独立部署，作为 PWA 与 Android 的共同云端备份服务

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Android%20%7C%20PWA-green.svg)
![Frontend](https://img.shields.io/badge/frontend-React%2019-61dafb.svg)
![Backend](https://img.shields.io/badge/backend-Fastify-black.svg)
![DB](https://img.shields.io/badge/storage-IndexedDB%20%7C%20SQLite-orange.svg)

</div>

---

## ✨ 特性

- 📋 **训练计划管理** — 创建、编辑、切换训练计划，内置力量/有氧模板库
- 🏋️ **力量训练记录** — 实时记录动作、组数、重量、次数，自动添加下一组，支持"加练"
- 🏃 **有氧训练记录** — 追踪时长、坡度、速度、热量消耗，独立开始/暂停/完成流程
- 📜 **训练历史** — 按日期分组浏览，支持搜索、详情查看、笔记编辑
- ⏱️ **训练计时器** — 训练总计时 + 组间休息计时器
- 🔒 **离线优先** — 所有数据存储在本地，无网络也能完整使用
- ☁️ **可选云端备份** — 全量快照备份/恢复，支持跨设备同步

## 📱 四大核心页面

| 页面         | 功能                                   |
| ------------ | -------------------------------------- |
| **今日训练** | 记录当前训练，支持力量 + 有氧两种模式  |
| **训练计划** | 管理训练计划，可从模板创建或自定义     |
| **训练历史** | 浏览历史记录，支持搜索、详情、笔记编辑 |
| **设置**     | 数据导入/导出、清除数据、应用信息      |

## 🏗 系统架构

同一套前端业务代码产出两个构建目标（PWA + Android），共享 UI 设计与数据契约；后端独立为单独服务，同时支撑两端可选云端备份。

### PWA（`pwa/`）— 纯前端 H5，离线优先

```
用户浏览器
  ↓
前端 nginx (Docker, :8081) ── 静态资源 + Service Worker
  ↓ （可选同源反代 /api/*）
后端 Fastify (backend/, :8080) ← 独立部署，可选
  ↓
PostgreSQL (Docker, :5432)

前端本地数据：IndexedDB (Dexie) — 唯一可信源
可选云端备份：POST /api/backups（全量快照）
```

### Android（`android/`）— 离线原生应用

```
Android App (Capacitor 8)
  ├── WebView 加载 pwa 构建产物（pwa/dist）
  ├── 本地 SQLite（@capacitor-community/sqlite）— 唯一可信源
  └── 原生能力：本地通知 / 触感 / 文件 / 分享

可选云端备份：复用 backend/ 后端 API
```

## 🚀 快速开始

### 方式一：PWA 前端本地 Docker 部署（推荐新人接手）

前置：[Docker Desktop](https://www.docker.com/products/docker-desktop)

```bash
cd pwa
docker compose up -d --build
```

启动后访问：http://localhost:8081

> PWA 是纯前端离线应用，不依赖 backend 容器。nginx 反代 /api/* 到 upstream `backend`，若未启动 backend 则仅云端备份失败，本地功能不受影响。需要联调后端时另起 `backend/docker-compose.yml`。

### 方式二：Backend 本地 Docker 部署（可选云端备份）

前置：Docker Desktop、一个 163 邮箱（用于发送登录验证码）

```bash
cd backend
# 先在 backend/.env 中填写 163 邮箱 SMTP 配置（参考 backend/.env.example）
docker compose up -d --build
```

启动后访问：http://localhost:8080/health

### 方式三：前端开发模式

```bash
cd pwa
npm install
npm run dev
```

### 方式四：Android 原生应用

```bash
cd android
npm install
npx cap add android     # 首次生成原生工程
npm run sync            # 构建前端并同步到原生工程
npm run open            # 用 Android Studio 打开调试
```

> 前置：Node.js 24、Android Studio（含 SDK，最低 API 24）、JDK 21。详见 [android/README.md](./android/README.md)。

## 🛠 技术栈

| 层               | 技术                                       |
| ---------------- | ------------------------------------------ |
| 前端 UI          | React 19 + TypeScript + MUI 7 + Zustand    |
| 前端构建         | Vite 7 + Vite PWA                          |
| 前端本地数据     | Dexie.js（IndexedDB）                      |
| 数据契约         | zod（前后端共享）                          |
| 后端             | Fastify + TypeScript + Prisma              |
| 后端数据库       | PostgreSQL 15                              |
| Android 容器     | Capacitor 8                                |
| Android 本地数据 | SQLite（@capacitor-community/sqlite）      |
| 部署             | Docker Compose（本地） / ACR 镜像（远程） |

## 📂 目录结构

```text
fit-topic
  ├── pwa/                        # 纯前端 H5/PWA（React 19 + Vite，离线优先）
  │   ├── src/
  │   │   ├── db/                 # 数据访问层（repository 抽象 + Dexie + SQLite schema）
  │   │   ├── stores/             # Zustand stores
  │   │   └── services/           # API client + 原生能力桥接 + 同步
  │   ├── public/                 # 静态资源（动作示意图、PWA 图标）
  │   ├── tests/                  # Vitest 测试
  │   ├── Dockerfile              # 前端镜像构建（nginx + 构建产物 + SW）
  │   ├── docker-compose.yml      # 本地前端容器栈
  │   ├── docker-bake.hcl         # 前端镜像多架构构建编排
  │   └── scripts/                # 前端镜像发布 + 部署验收
  ├── backend/                    # Fastify + Prisma 后端（PWA 与 Android 共同云端备份服务）
  │   ├── src/
  │   │   ├── routes/             # API 路由（auth/sync/healthz/admin）
  │   │   ├── repositories/       # 数据仓储（postgres/mock）
  │   │   └── events/             # 事件发布器（local/mock）
  │   ├── prisma/                 # Prisma schema + init.sql（幂等建表 SQL）
  │   ├── tests/
  │   ├── Dockerfile              # 后端镜像构建（api-runtime + worker-runtime multi-stage）
  │   ├── docker-compose.yml      # 本地后端容器栈（postgres + backend + worker）
  │   ├── docker-bake.hcl         # 后端镜像多架构构建编排（backend + worker）
  │   ├── docs/                   # 后端开发文档
  │   └── scripts/                # 后端镜像发布 + 部署验收
  ├── android/                    # Capacitor 安卓工程
  │   ├── capacitor.config.ts     # webDir → ../pwa/dist
  │   ├── package.json
  │   ├── android/                # 原生工程（cap add android 生成，已 gitignore）
  │   └── docs/
  │       └── android-architecture.md
  ├── docs/                       # 跨端共享：UI 设计、数据契约、架构决策、部署手册
  │   ├── architecture-decision.md  # 后端独立为单独服务的决策与模块化约束
  │   ├── 部署手册.md                # 跨端部署手册（本地开发 / 本地 Docker / 远程树莓派 Docker）
  │   ├── 产品需求文档.md            # 产品需求文档（功能性需求）
  │   ├── platforms/                # 平台说明（pwa.md / android.md）
  │   ├── ui/                        # UI 设计简报
  │   └── 部署架构图.png
  └── README.md / AGENTS.md
```

## 📚 文档

| 文档                                                                           | 说明                                                      |
| ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| [docs/产品需求文档.md](./docs/产品需求文档.md)                                | 产品需求文档：功能性需求、用户流程、范围与非目标          |
| [docs/部署手册.md](./docs/部署手册.md)                                       | 跨端部署手册：本地开发 / 本地 Docker / 远程树莓派 Docker  |
| [backend/docs/development.md](./backend/docs/development.md)                  | 后端开发指南：API 契约、数据库设计                        |
| [docs/architecture-decision.md](./docs/architecture-decision.md)              | 后端独立为单独服务的决策与模块化约束（跨端契约）          |
| [android/docs/android-architecture.md](./android/docs/android-architecture.md) | Android 离线版架构设计                                    |
| [AGENTS.md](./AGENTS.md)                                                       | 仓库开发规范（结构、命令、风格、提交约定）                |

## 构建、测试与开发命令

除非特别说明，命令均在对应包目录下执行。

PWA 前端（位于 `pwa/`）：

- `cd pwa && npm run dev`：启动 Vite dev server。
- `cd pwa && npm run build`：构建前端（同时运行 `tsc -b`）。
- `cd pwa && npm run lint` / `npm test`：ESLint / Vitest。
- `cd pwa && docker compose up -d --build`：前端本地 Docker 部署。
- `cd pwa && docker buildx bake --file docker-bake.hcl --push`：多架构镜像构建与发布（需 ACR 配置）。

Backend（位于 `backend/`）：

- `cd backend && npm run dev`：启动后端 API watcher。
- `cd backend && npm run dev:worker`：启动后端 worker watcher。
- `cd backend && npm run build`：构建后端。
- `cd backend && npm run typecheck`：后端类型检查。
- `cd backend && npm run db:push`：Prisma db push（MVP 期间直接推 schema）。
- `cd backend && docker compose up -d --build`：后端本地 Docker 部署。
- `cd backend && docker buildx bake --file docker-bake.hcl --push`：多架构镜像构建与发布（需 ACR 配置）。

Android（位于 `android/`）：

- `cd android && npm install`：安装 Capacitor 依赖。
- `cd android && npx cap add android`：生成原生工程（一次性；创建 `android/android/`）。
- `cd android && npm run sync`：构建 PWA 前端并同步到原生工程。
- `cd android && npm run open`：用 Android Studio 打开原生工程。

## 🗺 路线图

### PWA（已完成）

- [x] 前端部署（纯前端 H5，离线优先）
- [x] 后端服务骨架 + API 契约（独立为 `backend/`）
- [x] 数据库（PostgreSQL + Prisma）
- [x] 邮箱验证码登录（163 SMTP，无密码）
- [x] 本地事件驱动（HTTP push 到 worker）
- [x] 本地 Docker 部署拆分（前端栈 + 后端栈独立）
- [x] 远程树莓派 Docker 部署手册（ACR 镜像 digest + override compose）

### Android（进行中）

- [x] P1 容器化：Capacitor 接入，前端打包进 WebView
- [x] P2 仓储抽象：`DataRepository` 接口，Web 行为不变
- [ ] P3 SQLite 迁移：实现 `SqliteRepository`
- [ ] P4 原生能力：通知 / 触感 / 文件 / 分享
- [ ] P5 数据迁移与打磨：IndexedDB→SQLite 迁移、性能优化、发布候选

## 📄 许可证

MIT

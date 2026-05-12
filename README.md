# VibeFit 💪

## 一、项目概况

本项目是一个**移动端优先的个人健身训练计划与记录工具（PWA）**，用于：

- 📋 **管理训练计划** — 创建、编辑、切换训练计划
- 🏋️ **记录力量训练** — 实时记录动作、组数、重量、次数
- 🏃 **记录有氧训练** — 追踪时长、坡度、速度、热量消耗
- 📜 **查看训练历史** — 按日期分组浏览历史记录，支持搜索和笔记编辑
- 📊 **数据洞察** — 训练统计与连续性追踪
- 🔒 **离线优先** — 所有数据存储在本地，无需服务器

登录后：

- 用户管理：用户注册、登录、验证（JWT）。
- 数据同步：支持从本地（IndexedDB）同步到云端数据库。定期备份用户数据。
- 健身记录管理：管理健身计划、训练记录等数据。
- 数据备份与恢复：用户可以手动或自动进行数据备份。

### 功能概览

#### 📱 四大核心页面

| 页面         | 功能描述                                       |
| ------------ | ---------------------------------------------- |
| **今日训练** | 记录当前训练，支持力量训练和有氧训练两种模式   |
| **训练计划** | 管理训练计划，可从模板创建或自定义创建         |
| **训练历史** | 浏览历史训练记录，支持搜索、查看详情、编辑笔记 |
| **设置**     | 数据导入/导出、清除数据、应用信息              |

#### 🏋️ 力量训练功能

- 动作分组管理（背部、胸部、手臂等）
- 实时记录每组的重量和次数
- 一键标记完成状态
- 自动添加下一组
- 支持"加练"功能添加额外动作
- 训练计时器
- 休息计时器

#### 🏃 有氧训练功能

- 多种有氧运动类型（跑步机、椭圆机、划船机等）
- 记录时长、坡度、速度、热量
- 独立的开始/暂停/完成流程
- 每次有氧独立保存为训练记录

#### 📋 训练计划管理

- 内置训练模板库（力量训练、有氧训练等）
- 支持自定义创建训练计划
- 计划重命名和删除
- 当前使用中的计划标识
- 训练日进度追踪

#### 📜 训练历史

- 按日期分组显示（今天、昨天、更早）
- 显示训练类型图标（力量/有氧）
- 搜索功能（按动作名、计划名）
- 详情查看：动作列表、组记录、训练笔记
- 支持编辑和删除训练笔记

### 开发进展

- [x] 第 1 阶段：只部署前端
- [x] 第 2 阶段：加后端：后端服务骨架 + API 契约 + Mock 数据 + Mock 登录 + 前后端联调
- [x] 第 3 阶段：加数据库和密钥，目标：Cloud Run 后端能安全访问 Cloud SQL。
- [ ] 第 4 阶段：加密保与登录。
  - 生产环境：直接集成 Google OAuth。
  - 开发环境：用 mock JWT / Firebase Emulator / 测试 OAuth client。
- [ ] 第 5 阶段：加事件驱动，目标：Pub/Sub + Worker 跑通。
  - 本地可用 EventEmitter 或 Redis 模拟 Pub/Sub。
  - 生产环境用 Google Pub/Sub + Worker。
- [ ] 第 6 阶段：工程化，目标：CI/CD + 监控 + 告警 + runbook。

---

## 二、系统架构

```
用户手机浏览器
  ↓
VibeFit PWA on Cloud Run
  ↓
IndexedDB 本地数据

可选同步：
PWA
  ↓
Backend API on Cloud Run
  ↓
Cloud SQL PostgreSQL
  ↓
Pub/Sub
  ↓
Stats Worker on Cloud Run
  ↓
Cloud Logging / Monitoring
```

### 目录结构

```text
vibe-fit
  ├── frontend/
  │   ├── src/
  │   ├── Dockerfile
  │   └── package.json
  │
  ├── backend/
  │   ├── src/
  │   ├── prisma/
  │   ├── Dockerfile
  │   └── package.json
  │
  ├── worker/
  │   ├── src/
  │   ├── Dockerfile
  │   └── package.json
  │
  ├── infra/
  │   ├── cloudbuild.frontend.yaml
  │   ├── cloudbuild.backend.yaml
  │   ├── cloudbuild.worker.yaml
  │   └── README.md
  │
  ├── docs/
  │   ├── architecture.md
  │   ├── deploy-frontend-cloud-run.md
  │   ├── backend-api.md
  │   ├── database-design.md
  │   ├── cloud-sql-setup.md
  │   ├── iam-and-secrets.md
  │   ├── pubsub-events.md
  │   ├── cicd.md
  │   ├── observability.md
  │   └── runbook.md
  │
  └── README.md
```

---

## 许可证

MIT

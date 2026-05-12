# 数据库设计文档

## 1. 架构概览
Vibe-Fit 采用离线优先（Offline-First）的设计模式。
- **前端本地存储**: 使用 IndexedDB (通过 Dexie.js 封装) 作为主存储，确保在无网络环境下也能正常操作。
- **后端云端存储**: 使用 PostgreSQL (部署于 Google Cloud SQL) 作为备份和同步存储。

## 2. 前端数据库 (IndexedDB / Dexie.js)
数据库名称: `VibeFitDB`

### 2.1 表结构

#### `exercises` (动作库)
- `id` (string): 主键
- `name` (string): 动作名称
- `type` (string): 动作类型 (如: strength, cardio)

#### `plans` (训练计划)
- `id` (string): 主键
- `name` (string): 计划名称
- `isCurrent` (boolean): 是否为当前执行计划
- `isActive` (boolean): 是否激活

#### `sessions` (训练记录)
- `id` (string): 主键
- `planId` (string): 所属计划 ID
- `startedAt` (string): 开始时间 (ISO)
- `endedAt` (string): 结束时间 (ISO)

#### `settings` (应用设置)
- `weightUnit` (string): 重量单位 (kg/lb)
- `distanceUnit` (string): 距离单位 (km/mile)
- `darkMode` (boolean): 夜间模式

#### `pendingTraining` (未完成训练状态)
- `id` (string): 主键
- `planId` (string)
- `updatedAt` (string)

#### `syncQueue` (同步队列)
用于记录本地变更，待网络恢复后同步（当前版本主要使用全量备份）。
- `id` (string): 主键
- `table` (string)
- `recordId` (string)
- `action` (create/update/delete)
- `createdAt` (string)

#### `syncMeta` (同步元数据)
- `id` (string): 主键
- `lastSyncedAt` (string)
- `lastSyncStatus` (string)
- `deviceId` (string)

## 3. 后端数据库 (PostgreSQL / Prisma)

### 3.1 表结构 (Prisma Schema)

#### `User` (用户表)
- `id` (Uuid): 主键
- `email` (String): 唯一
- `passwordHash` (String): 密码哈希
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

#### `BackupSnapshot` (备份快照表)
存储用户完整数据的 JSON 快照。
- `id` (Uuid): 主键
- `userId` (Uuid): 外键，关联 User
- `deviceId` (String): 设备标识
- `payload` (Json): 包含 plans, sessions, settings, exercises 的完整 JSON 数据
- `createdAt` (DateTime)

#### `SyncMeta` (同步元数据表)
- `userId` (Uuid): 主键，关联 User
- `lastSyncedAt` (DateTime)
- `lastSyncStatus` (String)

## 4. 同步策略
当前版本采用 **全量快照备份 (Snapshot-based Backup & Restore)** 策略：
- **Push (推送)**: 前端将本地 IndexedDB 中的所有核心数据导出为 JSON Payload，调用 `POST /api/backups` 接口存入云端的 `backup_snapshots` 表。
- **Pull (拉取)**: 前端调用 `GET /api/backups/latest` 获取该用户最新的 JSON 快照，并将其覆盖导入到本地 IndexedDB 中，实现跨设备同步或数据恢复。

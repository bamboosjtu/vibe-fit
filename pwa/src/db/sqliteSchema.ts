/**
 * SQLite 本地数据库建表脚本（Android 端，@capacitor-community/sqlite）。
 *
 * 存储模型：混合（顶层字段建索引 + 嵌套结构存 JSON 列）。
 * 与 frontend/src/types/index.ts 的 zod schema 一一对应。
 * 详见 android/docs/android-architecture.md 第 4 节。
 *
 * 骨架状态：仅 DDL 与版本常量；SqliteRepository 初始化与迁移执行在 P3 实现。
 */

export const SQLITE_DB_NAME = 'vibefit.db';
export const SQLITE_DB_VERSION = 1;

/** 建表语句（按依赖顺序执行）。使用 IF NOT EXISTS 保证幂等。 */
export const CREATE_TABLES_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS exercises (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    type      TEXT NOT NULL,
    payload   TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name)`,
  `CREATE INDEX IF NOT EXISTS idx_exercises_type ON exercises(type)`,

  `CREATE TABLE IF NOT EXISTS plans (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    is_current  INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    payload     TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_plans_name      ON plans(name)`,
  `CREATE INDEX IF NOT EXISTS idx_plans_is_current ON plans(is_current)`,
  `CREATE INDEX IF NOT EXISTS idx_plans_is_active  ON plans(is_active)`,

  `CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    plan_id    TEXT,
    started_at TEXT NOT NULL,
    ended_at   TEXT,
    payload    TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_plan_id    ON sessions(plan_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC)`,

  `CREATE TABLE IF NOT EXISTS settings (
    id      INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL DEFAULT '{}'
  )`,

  `CREATE TABLE IF NOT EXISTS pending_training (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    plan_id    TEXT,
    updated_at TEXT NOT NULL,
    payload    TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pending_plan_id    ON pending_training(plan_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pending_updated_at ON pending_training(updated_at)`,

  `CREATE TABLE IF NOT EXISTS sync_queue (
    id           TEXT PRIMARY KEY,
    table_name   TEXT NOT NULL,
    record_id    TEXT NOT NULL,
    action       TEXT NOT NULL,
    payload      TEXT NOT NULL DEFAULT '{}',
    created_at   TEXT NOT NULL,
    retry_count  INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_table     ON sync_queue(table_name)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_record_id ON sync_queue(record_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at)`,

  `CREATE TABLE IF NOT EXISTS sync_meta (
    id                INTEGER PRIMARY KEY CHECK (id = 1),
    last_synced_at    TEXT,
    last_sync_status  TEXT,
    last_sync_error   TEXT,
    device_id         TEXT
  )`,
];

/**
 * 增量迁移脚本：key 为目标版本号，value 为该版本要执行的 SQL 数组。
 * 启动时读取 PRAGMA user_version，按顺序执行大于当前版本的迁移。
 */
export const MIGRATIONS: Record<number, string[]> = {
  1: CREATE_TABLES_SQL,
};

import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
  type capTask,
} from '@capacitor-community/sqlite';
import type {
  AppSettings,
  Exercise,
  TrainingPlan,
  TrainingSession,
} from '../types';
import type { PendingTrainingState } from './index';
import type { DataRepository, ExportSnapshot, ImportPayload } from './repository';
import {
  MIGRATIONS,
  SQLITE_DB_NAME,
  SQLITE_DB_VERSION,
} from './sqliteSchema';

/**
 * Android 数据访问实现：基于 @capacitor-community/sqlite。
 *
 * 存储模型为混合：顶层字段建索引（便于查询/排序），嵌套结构存 payload JSON 列。
 * 详见 sqliteSchema.ts 与 android/docs/android-architecture.md 第 4 节。
 *
 * 注意：本文件依赖 @capacitor-community/sqlite 原生插件，**只能**通过
 * repository.ts 中的 `await import('./sqliteRepo')` 动态导入，避免进入 Web 主 bundle。
 */

/** 原生查询返回的行：列名 → 列值（值类型可能为 string/number/null）。 */
type DbRow = Record<string, unknown>;

/** 安全解析 payload JSON 列。 */
function parsePayload(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || raw.length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** 把布尔值序列化为 SQLite INTEGER（0/1）。 */
function toInt(flag: boolean | undefined): number {
  return flag ? 1 : 0;
}

export class SqliteRepository implements DataRepository {
  private readonly sqliteService: SQLiteConnection;
  private conn: SQLiteDBConnection | null = null;

  constructor() {
    // CapacitorSQLite 为通过 registerPlugin 注册的原生插件代理
    this.sqliteService = new SQLiteConnection(CapacitorSQLite);
  }

  /**
   * 初始化连接并执行增量迁移。
   * 必须在所有数据访问前调用一次（由 initRepository() 保证）。
   */
  async init(): Promise<void> {
    // createConnection 内部会剥离 ".db" 后缀，传入完整名称亦可
    const conn = await this.sqliteService.createConnection(
      SQLITE_DB_NAME,
      false, // encrypted
      'no-encryption', // mode
      SQLITE_DB_VERSION,
      false, // readonly
    );
    await conn.open();
    this.conn = conn;

    // 读取 PRAGMA user_version，按顺序执行大于当前版本的迁移
    const versionRes = await conn.query('PRAGMA user_version');
    const currentVersion = Number(versionRes.values?.[0]?.user_version ?? 0);
    const targetVersions = Object.keys(MIGRATIONS)
      .map((v) => Number(v))
      .sort((a, b) => a - b);
    for (const v of targetVersions) {
      if (v > currentVersion) {
        // execute 接收以分号分隔的批量语句；transaction=false 避免 DDL/PRAGMA 受事务约束
        const batch = MIGRATIONS[v].join(';\n');
        await conn.execute(batch, false);
        await conn.execute(`PRAGMA user_version = ${v};`, false);
      }
    }
  }

  private getConnection(): SQLiteDBConnection {
    if (!this.conn) {
      throw new Error('SqliteRepository 未初始化，请先调用 init()');
    }
    return this.conn;
  }

  /** 执行查询并返回行数组。 */
  private async queryAll(sql: string, values?: unknown[]): Promise<DbRow[]> {
    const conn = this.getConnection();
    const res = await conn.query(sql, values as unknown[]);
    return (res.values ?? []) as DbRow[];
  }

  /** 执行查询并返回首行（无结果时 undefined）。 */
  private async queryOne(sql: string, values?: unknown[]): Promise<DbRow | undefined> {
    const rows = await this.queryAll(sql, values);
    return rows[0];
  }

  // 设置
  async initDefaultSettings(): Promise<void> {
    const existing = await this.queryOne('SELECT id FROM settings WHERE id = 1');
    if (!existing) {
      const defaults: AppSettings = {
        weightUnit: 'kg',
        distanceUnit: 'km',
        darkMode: false,
        schemaVersion: 1,
      };
      const conn = this.getConnection();
      await conn.run(
        'INSERT OR REPLACE INTO settings (id, payload) VALUES (?, ?)',
        [1, JSON.stringify(defaults)],
      );
    }
  }

  async getSettings(): Promise<AppSettings | undefined> {
    const row = await this.queryOne('SELECT payload FROM settings WHERE id = 1');
    if (!row) return undefined;
    return parsePayload(row.payload) as unknown as AppSettings;
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<void> {
    const current = await this.getSettings();
    const merged: AppSettings = {
      weightUnit: current?.weightUnit ?? 'kg',
      distanceUnit: current?.distanceUnit ?? 'km',
      darkMode: current?.darkMode ?? false,
      schemaVersion: current?.schemaVersion ?? 1,
      ...patch,
    };
    const conn = this.getConnection();
    await conn.run(
      'INSERT OR REPLACE INTO settings (id, payload) VALUES (?, ?)',
      [1, JSON.stringify(merged)],
    );
  }

  // 计划
  async getAllPlans(): Promise<TrainingPlan[]> {
    const rows = await this.queryAll('SELECT * FROM plans');
    return rows.map((r) => this.rowToPlan(r));
  }

  async getCurrentPlan(): Promise<TrainingPlan | undefined> {
    const row = await this.queryOne('SELECT * FROM plans WHERE is_current = 1 LIMIT 1');
    return row ? this.rowToPlan(row) : undefined;
  }

  async addPlan(plan: TrainingPlan): Promise<void> {
    await this.upsertPlan(plan);
  }

  async updatePlan(id: string, patch: Partial<TrainingPlan>): Promise<void> {
    // 全量覆盖：先取出当前行，合并 patch，再 INSERT OR REPLACE 整行
    const row = await this.queryOne('SELECT * FROM plans WHERE id = ?', [id]);
    if (!row) return;
    const current = this.rowToPlan(row);
    await this.upsertPlan({ ...current, ...patch, id });
  }

  async deletePlan(id: string): Promise<void> {
    const conn = this.getConnection();
    await conn.run('DELETE FROM plans WHERE id = ?', [id]);
  }

  async setCurrentPlan(id: string): Promise<void> {
    // 与 Dexie 行为一致：所有 plan 的 isCurrent 置 false，目标置 true
    const conn = this.getConnection();
    await conn.run('UPDATE plans SET is_current = 0');
    await conn.run('UPDATE plans SET is_current = 1 WHERE id = ?', [id]);
  }

  private async upsertPlan(plan: TrainingPlan): Promise<void> {
    const payload: Record<string, unknown> = {
      description: plan.description,
      days: plan.days,
      currentDayIndex: plan.currentDayIndex,
    };
    const conn = this.getConnection();
    await conn.run(
      `INSERT OR REPLACE INTO plans
        (id, name, is_current, is_active, created_at, updated_at, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        plan.id,
        plan.name,
        toInt(plan.isCurrent),
        toInt(plan.isActive),
        plan.createdAt,
        plan.updatedAt,
        JSON.stringify(payload),
      ],
    );
  }

  private rowToPlan(row: DbRow): TrainingPlan {
    const payload = parsePayload(row.payload);
    return {
      id: row.id as string,
      name: row.name as string,
      description: payload.description as string | undefined,
      days: (payload.days as TrainingPlan['days']) ?? [],
      isActive: !!row.is_active,
      isCurrent: !!row.is_current,
      currentDayIndex: (payload.currentDayIndex as number | undefined) ?? 0,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  // 训练会话
  async getAllSessions(): Promise<TrainingSession[]> {
    // 与 Dexie 一致：按 startedAt 倒序
    const rows = await this.queryAll('SELECT * FROM sessions ORDER BY started_at DESC');
    return rows.map((r) => this.rowToSession(r));
  }

  async getSessionById(id: string): Promise<TrainingSession | undefined> {
    const row = await this.queryOne('SELECT * FROM sessions WHERE id = ?', [id]);
    return row ? this.rowToSession(row) : undefined;
  }

  async getRecentSessions(limit: number = 10): Promise<TrainingSession[]> {
    const rows = await this.queryAll(
      'SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?',
      [limit],
    );
    return rows.map((r) => this.rowToSession(r));
  }

  async addSession(session: TrainingSession): Promise<void> {
    await this.upsertSession(session);
  }

  async updateSession(id: string, patch: Partial<TrainingSession>): Promise<void> {
    // 全量覆盖：先取出当前行，合并 patch，再 INSERT OR REPLACE 整行
    const row = await this.queryOne('SELECT * FROM sessions WHERE id = ?', [id]);
    if (!row) return;
    const current = this.rowToSession(row);
    await this.upsertSession({ ...current, ...patch, id });
  }

  async deleteSession(id: string): Promise<void> {
    const conn = this.getConnection();
    await conn.run('DELETE FROM sessions WHERE id = ?', [id]);
  }

  private async upsertSession(session: TrainingSession): Promise<void> {
    const payload: Record<string, unknown> = {
      dayId: session.dayId,
      dayName: session.dayName,
      exercises: session.exercises,
      notes: session.notes,
      // planId 亦存入 payload，读取时优先用 plan_id 列
      planId: session.planId,
    };
    const conn = this.getConnection();
    await conn.run(
      `INSERT OR REPLACE INTO sessions
        (id, plan_id, started_at, ended_at, payload)
       VALUES (?, ?, ?, ?, ?)`,
      [
        session.id,
        session.planId ?? null,
        session.startedAt,
        session.endedAt ?? null,
        JSON.stringify(payload),
      ],
    );
  }

  private rowToSession(row: DbRow): TrainingSession {
    const payload = parsePayload(row.payload);
    return {
      id: row.id as string,
      // planId 优先取顶层 plan_id 列，回退到 payload.planId
      planId: (row.plan_id as string | null) ?? (payload.planId as string | undefined),
      startedAt: row.started_at as string,
      endedAt: (row.ended_at as string | null) ?? undefined,
      dayId: payload.dayId as string | undefined,
      dayName: payload.dayName as string | undefined,
      exercises: (payload.exercises as TrainingSession['exercises']) ?? [],
      notes: payload.notes as string | undefined,
    };
  }

  // 动作库
  async getAllExercises(): Promise<Exercise[]> {
    const rows = await this.queryAll('SELECT * FROM exercises');
    return rows.map((r) => this.rowToExercise(r));
  }

  async addExercise(exercise: Exercise): Promise<void> {
    await this.upsertExercise(exercise);
  }

  async addExercises(exercises: Exercise[]): Promise<void> {
    for (const e of exercises) {
      await this.upsertExercise(e);
    }
  }

  private async upsertExercise(exercise: Exercise): Promise<void> {
    const payload: Record<string, unknown> = {
      muscleGroups: exercise.muscleGroups,
      description: exercise.description,
      videoUrl: exercise.videoUrl,
    };
    const conn = this.getConnection();
    await conn.run(
      `INSERT OR REPLACE INTO exercises (id, name, type, payload) VALUES (?, ?, ?, ?)`,
      [
        exercise.id,
        exercise.name,
        exercise.type,
        JSON.stringify(payload),
      ],
    );
  }

  private rowToExercise(row: DbRow): Exercise {
    const payload = parsePayload(row.payload);
    return {
      id: row.id as string,
      name: row.name as string,
      type: row.type as Exercise['type'],
      muscleGroups: payload.muscleGroups as string[] | undefined,
      description: payload.description as string | undefined,
      videoUrl: payload.videoUrl as string | undefined,
    };
  }

  // 未完成训练
  async savePendingTraining(state: PendingTrainingState): Promise<void> {
    // payload 存完整 TrainingSession，updated_at 单独列；读取时合并 {...payload, updatedAt}
    const { updatedAt, ...session } = state;
    const markedAt = new Date().toISOString();
    const conn = this.getConnection();
    await conn.run(
      `INSERT OR REPLACE INTO pending_training (id, plan_id, updated_at, payload) VALUES (?, ?, ?, ?)`,
      [
        1,
        session.planId ?? null,
        markedAt,
        JSON.stringify(session),
      ],
    );
  }

  async getPendingTraining(): Promise<PendingTrainingState | undefined> {
    const row = await this.queryOne('SELECT * FROM pending_training WHERE id = 1');
    if (!row) return undefined;
    const payload = parsePayload(row.payload);
    return {
      ...(payload as unknown as TrainingSession),
      updatedAt: row.updated_at as string,
    };
  }

  async deletePendingTraining(): Promise<void> {
    const conn = this.getConnection();
    await conn.run('DELETE FROM pending_training WHERE id = 1');
  }

  // 导入导出 / 清空
  async exportAllData(): Promise<ExportSnapshot> {
    const [settings, plans, sessions, exercises] = await Promise.all([
      this.getSettings(),
      this.getAllPlans(),
      this.getAllSessions(),
      this.getAllExercises(),
    ]);
    return { settings, plans, sessions, exercises };
  }

  async importAllData(data: ImportPayload): Promise<void> {
    // 事务内先清空可导入的业务表，再批量插入
    const tasks: capTask[] = [
      { statement: 'DELETE FROM exercises' },
      { statement: 'DELETE FROM plans' },
      { statement: 'DELETE FROM sessions' },
      { statement: 'DELETE FROM settings' },
    ];

    if (data.settings) {
      tasks.push({
        statement: 'INSERT OR REPLACE INTO settings (id, payload) VALUES (?, ?)',
        values: [1, JSON.stringify(data.settings)],
      });
    }
    for (const p of data.plans ?? []) {
      const payload: Record<string, unknown> = {
        description: p.description,
        days: p.days,
        currentDayIndex: p.currentDayIndex,
      };
      tasks.push({
        statement: `INSERT OR REPLACE INTO plans
          (id, name, is_current, is_active, created_at, updated_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        values: [
          p.id,
          p.name,
          toInt(p.isCurrent),
          toInt(p.isActive),
          p.createdAt,
          p.updatedAt,
          JSON.stringify(payload),
        ],
      });
    }
    for (const s of data.sessions ?? []) {
      const payload: Record<string, unknown> = {
        dayId: s.dayId,
        dayName: s.dayName,
        exercises: s.exercises,
        notes: s.notes,
        planId: s.planId,
      };
      tasks.push({
        statement: `INSERT OR REPLACE INTO sessions
          (id, plan_id, started_at, ended_at, payload) VALUES (?, ?, ?, ?, ?)`,
        values: [s.id, s.planId ?? null, s.startedAt, s.endedAt ?? null, JSON.stringify(payload)],
      });
    }
    for (const e of data.exercises ?? []) {
      const payload: Record<string, unknown> = {
        muscleGroups: e.muscleGroups,
        description: e.description,
        videoUrl: e.videoUrl,
      };
      tasks.push({
        statement: 'INSERT OR REPLACE INTO exercises (id, name, type, payload) VALUES (?, ?, ?, ?)',
        values: [e.id, e.name, e.type, JSON.stringify(payload)],
      });
    }

    const conn = this.getConnection();
    await conn.executeTransaction(tasks);
  }

  async clearAllData(): Promise<void> {
    // 与 Dexie clearAllData 一致：清空全部业务表
    const conn = this.getConnection();
    await conn.execute(
      [
        'DELETE FROM exercises;',
        'DELETE FROM plans;',
        'DELETE FROM sessions;',
        'DELETE FROM settings;',
        'DELETE FROM pending_training;',
        'DELETE FROM sync_queue;',
        'DELETE FROM sync_meta;',
      ].join('\n'),
      false,
    );
  }
}

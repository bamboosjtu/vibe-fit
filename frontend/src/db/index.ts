import Dexie, { type Table } from 'dexie';
import type {
  Exercise,
  TrainingPlan,
  TrainingSession,
  AppSettings,
} from '../types';

const DB_NAME = 'VibeFitDB';
const DB_VERSION = 3;

// 未完成的训练状态
export type PendingTrainingState = TrainingSession & { updatedAt: string };

// 同步队列项
export interface SyncQueueItem {
  id: string;
  table: 'plans' | 'sessions' | 'settings' | 'exercises';
  action: 'create' | 'update' | 'delete';
  recordId: string;
  payload: unknown;
  createdAt: string;
  retryCount: number;
}

// 同步元数据
export interface SyncMeta {
  id: string;
  lastSyncedAt: string | null;
  lastSyncStatus: 'success' | 'failed' | 'pending' | null;
  lastSyncError: string | null;
  deviceId: string;
}

export class VibeFitDatabase extends Dexie {
  exercises!: Table<Exercise>;
  plans!: Table<TrainingPlan>;
  sessions!: Table<TrainingSession>;
  settings!: Table<AppSettings>;
  pendingTraining!: Table<PendingTrainingState>;
  syncQueue!: Table<SyncQueueItem>;
  syncMeta!: Table<SyncMeta>;

  constructor() {
    super(DB_NAME);

    this.version(DB_VERSION).stores({
      exercises: 'id, name, type',
      plans: 'id, name, isCurrent, isActive',
      sessions: 'id, planId, startedAt, endedAt',
      settings: 'weightUnit, distanceUnit, darkMode',
      pendingTraining: 'id, planId, updatedAt',
      syncQueue: 'id, table, recordId, createdAt',
      syncMeta: 'id',
    });
  }
}

export const db = new VibeFitDatabase();

// 初始化默认设置
export async function initDefaultSettings(): Promise<void> {
  const count = await db.settings.count();
  if (count === 0) {
    await db.settings.add({
      weightUnit: 'kg',
      distanceUnit: 'km',
      darkMode: false,
      schemaVersion: 1,
    });
  }
}

// 获取设置
export async function getSettings(): Promise<AppSettings | undefined> {
  const settings = await db.settings.toArray();
  return settings[0];
}

// 更新设置
export async function updateSettings(settings: Partial<AppSettings>): Promise<void> {
  const current = await getSettings();
  if (current) {
    await db.settings.update(current, settings);
  }
}

// 计划相关操作
export async function getAllPlans(): Promise<TrainingPlan[]> {
  return db.plans.toArray();
}

export async function getCurrentPlan(): Promise<TrainingPlan | undefined> {
  const plans = await db.plans.toArray();
  return plans.find(p => p.isCurrent === true);
}

export async function addPlan(plan: TrainingPlan): Promise<void> {
  await db.plans.add(plan);
}

export async function updatePlan(id: string, plan: Partial<TrainingPlan>): Promise<void> {
  await db.plans.update(id, plan);
}

export async function deletePlan(id: string): Promise<void> {
  await db.plans.delete(id);
}

export async function setCurrentPlan(id: string): Promise<void> {
  await db.plans.toCollection().modify((plan) => {
    plan.isCurrent = plan.id === id;
  });
}

// 训练会话相关操作
export async function getAllSessions(): Promise<TrainingSession[]> {
  return db.sessions.orderBy('startedAt').reverse().toArray();
}

export async function getSessionById(id: string): Promise<TrainingSession | undefined> {
  return db.sessions.get(id);
}

export async function addSession(session: TrainingSession): Promise<void> {
  await db.sessions.add(session);
}

export async function updateSession(id: string, session: Partial<TrainingSession>): Promise<void> {
  await db.sessions.update(id, session);
}

export async function deleteSession(id: string): Promise<void> {
  await db.sessions.delete(id);
}

// 获取最近的训练会话
export async function getRecentSessions(limit: number = 10): Promise<TrainingSession[]> {
  return db.sessions
    .orderBy('startedAt')
    .reverse()
    .limit(limit)
    .toArray();
}

// 动作库相关操作
export async function getAllExercises(): Promise<Exercise[]> {
  return db.exercises.toArray();
}

export async function addExercise(exercise: Exercise): Promise<void> {
  await db.exercises.add(exercise);
}

export async function addExercises(exercises: Exercise[]): Promise<void> {
  await db.exercises.bulkAdd(exercises);
}

// 数据导出
export async function exportAllData(): Promise<{
  settings: AppSettings | undefined;
  plans: TrainingPlan[];
  sessions: TrainingSession[];
  exercises: Exercise[];
}> {
  const [settings, plans, sessions, exercises] = await Promise.all([
    getSettings(),
    getAllPlans(),
    getAllSessions(),
    getAllExercises(),
  ]);

  return {
    settings,
    plans,
    sessions,
    exercises,
  };
}

// 数据导入（会清空现有数据）
export async function importAllData(data: {
  settings?: AppSettings;
  plans?: TrainingPlan[];
  sessions?: TrainingSession[];
  exercises?: Exercise[];
}): Promise<void> {
  await db.transaction('rw', db.exercises, db.plans, db.sessions, db.settings, async () => {
    await Promise.all([
      db.exercises.clear(),
      db.plans.clear(),
      db.sessions.clear(),
      db.settings.clear(),
    ]);

    if (data.settings) {
      await db.settings.add(data.settings);
    }
    if (data.plans?.length) {
      await db.plans.bulkAdd(data.plans);
    }
    if (data.sessions?.length) {
      await db.sessions.bulkAdd(data.sessions);
    }
    if (data.exercises?.length) {
      await db.exercises.bulkAdd(data.exercises);
    }
  });
}

// 清除所有数据
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.exercises, db.plans, db.sessions, db.settings, db.pendingTraining, db.syncQueue, db.syncMeta], async () => {
    await Promise.all([
      db.exercises.clear(),
      db.plans.clear(),
      db.sessions.clear(),
      db.settings.clear(),
      db.pendingTraining.clear(),
      db.syncQueue.clear(),
      db.syncMeta.clear(),
    ]);
  });
}

// 保存未完成的训练状态
export async function savePendingTraining(state: PendingTrainingState): Promise<void> {
  await db.pendingTraining.put({ ...state, updatedAt: new Date().toISOString() });
}

// 获取未完成的训练状态
export async function getPendingTraining(): Promise<PendingTrainingState | undefined> {
  const trainings = await db.pendingTraining.toArray();
  return trainings[0];
}

// 删除未完成的训练状态
export async function deletePendingTraining(): Promise<void> {
  await db.pendingTraining.clear();
}

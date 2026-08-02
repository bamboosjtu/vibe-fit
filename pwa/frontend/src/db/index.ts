import Dexie, { type Table } from 'dexie';
import type {
  Exercise,
  TrainingPlan,
  TrainingSession,
  AppSettings,
} from '../types';
import { getRepository, type ExportSnapshot, type ImportPayload } from './repository';

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

// 以下具名导出透传 repository：Web 走 DexieRepository、Android 走 SqliteRepository。
// store / 组件层无需任何改动（仍 `import { ... } from '../db'`）。

// 设置
export const initDefaultSettings = () => getRepository().initDefaultSettings();
export const getSettings = () => getRepository().getSettings();
export const updateSettings = (settings: Partial<AppSettings>) =>
  getRepository().updateSettings(settings);

// 计划相关操作
export const getAllPlans = () => getRepository().getAllPlans();
export const getCurrentPlan = () => getRepository().getCurrentPlan();
export const addPlan = (plan: TrainingPlan) => getRepository().addPlan(plan);
export const updatePlan = (id: string, plan: Partial<TrainingPlan>) =>
  getRepository().updatePlan(id, plan);
export const deletePlan = (id: string) => getRepository().deletePlan(id);
export const setCurrentPlan = (id: string) => getRepository().setCurrentPlan(id);

// 训练会话相关操作
export const getAllSessions = () => getRepository().getAllSessions();
export const getSessionById = (id: string) => getRepository().getSessionById(id);
export const addSession = (session: TrainingSession) => getRepository().addSession(session);
export const updateSession = (id: string, session: Partial<TrainingSession>) =>
  getRepository().updateSession(id, session);
export const deleteSession = (id: string) => getRepository().deleteSession(id);

// 获取最近的训练会话
export const getRecentSessions = (limit: number = 10) =>
  getRepository().getRecentSessions(limit);

// 动作库相关操作
export const getAllExercises = () => getRepository().getAllExercises();
export const addExercise = (exercise: Exercise) => getRepository().addExercise(exercise);
export const addExercises = (exercises: Exercise[]) => getRepository().addExercises(exercises);

// 数据导出
export const exportAllData = (): Promise<ExportSnapshot> => getRepository().exportAllData();

// 数据导入（会清空现有数据）
export const importAllData = (data: ImportPayload): Promise<void> =>
  getRepository().importAllData(data);

// 清除所有数据
export const clearAllData = () => getRepository().clearAllData();

/**
 * 彻底删除整个数据库（开发阶段重置专用）。
 * 调用后需要刷新页面以重建数据库。
 */
export async function deleteDatabase(): Promise<void> {
  await db.delete();
  // 阻止 Dexie 重新打开，需刷新页面
  window.location.reload();
}

// 未完成训练状态
export const savePendingTraining = (state: PendingTrainingState) =>
  getRepository().savePendingTraining(state);
export const getPendingTraining = () => getRepository().getPendingTraining();
export const deletePendingTraining = () => getRepository().deletePendingTraining();

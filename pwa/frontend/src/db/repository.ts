import type {
  AppSettings,
  Exercise,
  TrainingPlan,
  TrainingSession,
} from '../types';
import type { PendingTrainingState } from './index';
// DexieRepository 不依赖任何原生插件，可安全静态 import，不影响 Web 主 bundle。
import { DexieRepository } from './dexieRepo';

/**
 * 数据访问层统一契约。
 *
 * 上层（Zustand stores / 组件）只依赖此接口，不感知底层是 IndexedDB 还是 SQLite。
 * - Web / PWA：DexieRepository（封装现有 Dexie 调用）
 * - Android：SqliteRepository（@capacitor-community/sqlite）
 *
 * 详见 android/docs/android-architecture.md 第 5 节。
 */

/** exportAllData 返回结构，与原 db/index.ts 保持一致。 */
export interface ExportSnapshot {
  settings: AppSettings | undefined;
  plans: TrainingPlan[];
  sessions: TrainingSession[];
  exercises: Exercise[];
}

/** importAllData 入参结构，与原 db/index.ts 保持一致。 */
export interface ImportPayload {
  settings?: AppSettings;
  plans?: TrainingPlan[];
  sessions?: TrainingSession[];
  exercises?: Exercise[];
}

export interface DataRepository {
  // 设置
  initDefaultSettings(): Promise<void>;
  getSettings(): Promise<AppSettings | undefined>;
  updateSettings(patch: Partial<AppSettings>): Promise<void>;

  // 计划
  getAllPlans(): Promise<TrainingPlan[]>;
  getCurrentPlan(): Promise<TrainingPlan | undefined>;
  addPlan(plan: TrainingPlan): Promise<void>;
  updatePlan(id: string, patch: Partial<TrainingPlan>): Promise<void>;
  deletePlan(id: string): Promise<void>;
  setCurrentPlan(id: string): Promise<void>;

  // 训练会话
  getAllSessions(): Promise<TrainingSession[]>;
  getSessionById(id: string): Promise<TrainingSession | undefined>;
  getRecentSessions(limit?: number): Promise<TrainingSession[]>;
  addSession(session: TrainingSession): Promise<void>;
  updateSession(id: string, patch: Partial<TrainingSession>): Promise<void>;
  deleteSession(id: string): Promise<void>;

  // 动作库
  getAllExercises(): Promise<Exercise[]>;
  addExercise(exercise: Exercise): Promise<void>;
  addExercises(exercises: Exercise[]): Promise<void>;

  // 未完成训练
  savePendingTraining(state: PendingTrainingState): Promise<void>;
  getPendingTraining(): Promise<PendingTrainingState | undefined>;
  deletePendingTraining(): Promise<void>;

  // 导入导出 / 清空
  exportAllData(): Promise<ExportSnapshot>;
  importAllData(data: ImportPayload): Promise<void>;
  clearAllData(): Promise<void>;
}

/**
 * 平台检测：不依赖 @capacitor/core，通过 Capacitor 运行时注入的 window.Capacitor 判断。
 * - Web：window.Capacitor 不存在 → false
 * - Android（Capacitor 原生壳）：返回 true
 */
export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!capacitor?.isNativePlatform?.();
}

let repoInstance: DataRepository | null = null;
let initPromise: Promise<DataRepository> | null = null;

/**
 * 同步获取已初始化的仓储实例。
 * - Web：首次调用惰性创建 DexieRepository（Dexie 连接本身在 db/index.ts 顶层已建好）。
 * - Android：必须先由 main.tsx 调用 initRepository() 完成 SQLite 初始化，否则抛错。
 */
export function getRepository(): DataRepository {
  if (repoInstance) return repoInstance;
  if (!isNativePlatform()) {
    repoInstance = new DexieRepository();
    return repoInstance;
  }
  throw new Error('Repository 未初始化，原生平台启动时必须先调用 initRepository()');
}

/**
 * 异步初始化仓储。main.tsx 启动时调用一次：
 * - Web：惰性创建 DexieRepository（与 getRepository 等价，幂等）。
 * - Android：动态 import SqliteRepository 并执行建表/迁移，确保后续 getRepository() 可用。
 *
 * SqliteRepository 通过 `await import('./sqliteRepo')` 动态导入，
 * 保证 @capacitor-community/sqlite 不进入 Web 主 bundle。
 */
export async function initRepository(): Promise<DataRepository> {
  if (repoInstance) return repoInstance;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (isNativePlatform()) {
      const { SqliteRepository } = await import('./sqliteRepo');
      const repo = new SqliteRepository();
      await repo.init();
      repoInstance = repo;
    } else {
      repoInstance = new DexieRepository();
    }
    return repoInstance!;
  })();
  return initPromise;
}

/**
 * 仓储工厂（保留以兼容老调用点）。推荐直接使用 getRepository() / initRepository()。
 * 等价于同步获取已初始化实例；未初始化时 Web 上惰性创建、原生上抛错。
 */
export function createRepository(): DataRepository {
  return getRepository();
}

import type {
  AppSettings,
  Exercise,
  TrainingPlan,
  TrainingSession,
} from '../types';
import { db, type PendingTrainingState } from './index';
import type { DataRepository, ExportSnapshot, ImportPayload } from './repository';

/**
 * Web/PWA 数据访问实现：封装现有 Dexie 调用。
 *
 * 行为与原 db/index.ts 函数完全一致，仅是把逻辑搬进类形式，便于通过
 * DataRepository 接口统一选择实现。Web 上由 getRepository() 惰性创建实例。
 *
 * 注意：本类不依赖任何原生插件，可被静态 import，不影响 Web 构建产物。
 */
export class DexieRepository implements DataRepository {
  // 设置
  async initDefaultSettings(): Promise<void> {
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

  async getSettings(): Promise<AppSettings | undefined> {
    const settings = await db.settings.toArray();
    return settings[0];
  }

  async updateSettings(settings: Partial<AppSettings>): Promise<void> {
    const current = await this.getSettings();
    if (current) {
      await db.settings.update(current, settings);
    }
  }

  // 计划
  async getAllPlans(): Promise<TrainingPlan[]> {
    return db.plans.toArray();
  }

  async getCurrentPlan(): Promise<TrainingPlan | undefined> {
    const plans = await db.plans.toArray();
    return plans.find((p) => p.isCurrent === true);
  }

  async addPlan(plan: TrainingPlan): Promise<void> {
    await db.plans.add(plan);
  }

  async updatePlan(id: string, patch: Partial<TrainingPlan>): Promise<void> {
    await db.plans.update(id, patch);
  }

  async deletePlan(id: string): Promise<void> {
    await db.plans.delete(id);
  }

  async setCurrentPlan(id: string): Promise<void> {
    // 与原 db/index.ts 一致：把所有 plan 的 isCurrent 置为 (plan.id === id)
    await db.plans.toCollection().modify((plan) => {
      plan.isCurrent = plan.id === id;
    });
  }

  // 训练会话
  async getAllSessions(): Promise<TrainingSession[]> {
    return db.sessions.orderBy('startedAt').reverse().toArray();
  }

  async getSessionById(id: string): Promise<TrainingSession | undefined> {
    return db.sessions.get(id);
  }

  async getRecentSessions(limit: number = 10): Promise<TrainingSession[]> {
    return db.sessions
      .orderBy('startedAt')
      .reverse()
      .limit(limit)
      .toArray();
  }

  async addSession(session: TrainingSession): Promise<void> {
    await db.sessions.add(session);
  }

  async updateSession(id: string, patch: Partial<TrainingSession>): Promise<void> {
    await db.sessions.update(id, patch);
  }

  async deleteSession(id: string): Promise<void> {
    await db.sessions.delete(id);
  }

  // 动作库
  async getAllExercises(): Promise<Exercise[]> {
    return db.exercises.toArray();
  }

  async addExercise(exercise: Exercise): Promise<void> {
    await db.exercises.add(exercise);
  }

  async addExercises(exercises: Exercise[]): Promise<void> {
    await db.exercises.bulkAdd(exercises);
  }

  // 未完成训练
  async savePendingTraining(state: PendingTrainingState): Promise<void> {
    await db.pendingTraining.put({ ...state, updatedAt: new Date().toISOString() });
  }

  async getPendingTraining(): Promise<PendingTrainingState | undefined> {
    const trainings = await db.pendingTraining.toArray();
    return trainings[0];
  }

  async deletePendingTraining(): Promise<void> {
    await db.pendingTraining.clear();
  }

  // 导入导出 / 清空
  async exportAllData(): Promise<ExportSnapshot> {
    const [settings, plans, sessions, exercises] = await Promise.all([
      this.getSettings(),
      this.getAllPlans(),
      this.getAllSessions(),
      this.getAllExercises(),
    ]);

    return {
      settings,
      plans,
      sessions,
      exercises,
    };
  }

  async importAllData(data: ImportPayload): Promise<void> {
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

  async clearAllData(): Promise<void> {
    await db.transaction(
      'rw',
      [db.exercises, db.plans, db.sessions, db.settings, db.pendingTraining, db.syncQueue, db.syncMeta],
      async () => {
        await Promise.all([
          db.exercises.clear(),
          db.plans.clear(),
          db.sessions.clear(),
          db.settings.clear(),
          db.pendingTraining.clear(),
          db.syncQueue.clear(),
          db.syncMeta.clear(),
        ]);
      },
    );
  }
}

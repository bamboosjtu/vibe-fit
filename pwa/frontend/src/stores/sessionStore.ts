import { create } from 'zustand';
import type {
  TrainingSession,
  SessionExercise,
  SetRecord,
  TrainingPlan,
  TrainingDay,
  Exercise,
} from '../types';
import {
  getAllSessions,
  getSessionById,
  addSession as dbAddSession,
  updateSession as dbUpdateSession,
  deleteSession as dbDeleteSession,
  getPendingTraining,
  savePendingTraining,
  deletePendingTraining,
} from '../db';
import { generateId, getCurrentISOString } from '../utils/helpers';
import {
  checkpointTimer,
  pauseTimer,
  endTimer,
  endAtLastCheckpoint,
  continueAfterGap,
  migrateLegacySession,
  isStaleSession,
} from '../domain/sessionTimer';

interface SessionState {
  sessions: TrainingSession[];
  activeSession: TrainingSession | null;
  staleSession: TrainingSession | null;
  restTimer: number;
  restTimerExerciseId: string | null;
  isRestTimerActive: boolean;
  isLoading: boolean;
  initialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  loadSessions: () => Promise<void>;

  // 训练会话管理
  startSession: (plan?: TrainingPlan, day?: TrainingDay) => TrainingSession;
  resumeSession: () => Promise<boolean>;
  ensureSession: (plan?: TrainingPlan, day?: TrainingDay) => TrainingSession;
  endSession: (notes?: string) => Promise<void>;
  cancelSession: () => Promise<void>;
  clearActiveSession: () => void;

  // 计时器管理
  pauseSession: () => void;
  continueSession: () => void;
  checkpointSession: () => void;
  resolveStaleSession: (action: 'continue' | 'end' | 'discard') => Promise<void>;

  // 休息计时器
  startRestTimer: (seconds: number, sessionExerciseId?: string) => void;
  decrementRestTimer: () => void;
  stopRestTimer: () => void;

  // 动作管理
  addExercise: (exercise: Exercise, phaseId?: string, groupId?: string) => void;
  removeExercise: (sessionExerciseId: string) => void;
  reorderExercises: (exerciseIds: string[]) => void;

  // 组记录管理
  addSet: (sessionExerciseId: string, setData: Partial<SetRecord>) => void;
  updateSet: (sessionExerciseId: string, setId: string, updates: Partial<SetRecord>) => void;
  deleteSet: (sessionExerciseId: string, setId: string) => void;
  toggleSetCompleted: (sessionExerciseId: string, setId: string) => void;
  copyLastSet: (sessionExerciseId: string) => void;

  // 历史记录
  getSessionById: (id: string) => Promise<TrainingSession | undefined>;
  deleteSession: (id: string) => Promise<void>;
  updateSessionNotes: (id: string, notes: string) => Promise<void>;

  // 内部：串行持久化 pending training
  _persistPending: () => Promise<void>;
}

// 串行写入队列，防止旧写入覆盖新状态
let writeQueue: Promise<void> = Promise.resolve();

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSession: null,
  staleSession: null,
  restTimer: 0,
  restTimerExerciseId: null,
  isRestTimerActive: false,
  isLoading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;
    await get().loadSessions();
    await get().resumeSession();
    set({ initialized: true });
  },

  loadSessions: async () => {
    set({ isLoading: true });
    try {
      const sessions = await getAllSessions();
      set({ sessions });
    } finally {
      set({ isLoading: false });
    }
  },

  startSession: (plan, day) => {
    const now = getCurrentISOString();
    const session: TrainingSession = {
      id: generateId(),
      planId: plan?.id,
      dayId: day?.id,
      dayName: day?.name,
      startedAt: now,
      exercises: [],
      notes: '',
      timerStatus: 'running',
      elapsedSeconds: 0,
      runningSince: now,
      lastCheckpointAt: now,
    };

    if (day) {
      const exercises: TrainingSession['exercises'] = [];
      let order = 0;

      day.phases?.forEach((phase) => {
        phase.groups?.forEach((group) => {
          group.selectedExercises?.forEach((config) => {
            const exerciseId = config.exerciseId;
            const numSets = config.targetSets || 3;
            const sets: SetRecord[] = Array.from({ length: numSets }, (_, i) => ({
              id: generateId(),
              exerciseId,
              setNumber: i + 1,
              reps: config.targetReps || 12,
              weight: 0,
              completedAt: '',
            }));

            exercises.push({
              id: generateId(),
              exerciseId,
              exerciseName: config.exerciseName,
              type: config.type,
              sets,
              order: order++,
              phaseId: phase.id,
              groupId: group.id,
            });
          });
        });
      });

      session.exercises = exercises;
    }

    set({ activeSession: session, staleSession: null });
    get()._persistPending();
    return session;
  },

  resumeSession: async () => {
    const pending = await getPendingTraining();
    if (!pending) return false;

    // 迁移旧数据（无计时器字段）
    const migrated = migrateLegacySession(pending);

    // 数据结构迁移：确保旧动作也有 phaseId/groupId
    const exercises = (migrated.exercises as SessionExercise[]).map((ex) => ({
      ...ex,
      phaseId: ex.phaseId || 'legacy',
      groupId: ex.groupId || 'legacy',
    }));

    const session = { ...migrated, exercises } as TrainingSession;

    // 已暂停的记录：恢复为暂停
    if (session.timerStatus === 'paused') {
      set({ activeSession: session, staleSession: null });
      return true;
    }

    // 运行中的记录：检查是否异常中断
    if (session.timerStatus === 'running') {
      if (isStaleSession(session)) {
        // 超过 4 小时或跨自然日：显示恢复对话框，不自动恢复
        set({ staleSession: session, activeSession: null });
        return false;
      }

      // 同一天且不超过 4 小时：正常恢复运行
      // 保持 runningSince 不变，按时间戳计算
      set({ activeSession: session, staleSession: null });
      return true;
    }

    // 其他状态（如 completed）不恢复
    return false;
  },

  ensureSession: (plan, day) => {
    const { activeSession } = get();
    if (activeSession) return activeSession;
    return get().startSession(plan, day);
  },

  endSession: async (notes) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const timerFields = endTimer(activeSession);
    const completedSession: TrainingSession = {
      ...activeSession,
      ...timerFields,
      notes: notes || activeSession.notes,
    };

    await dbAddSession(completedSession);
    await deletePendingTraining();
    set({
      activeSession: null,
      staleSession: null,
      restTimer: 0,
      restTimerExerciseId: null,
      isRestTimerActive: false,
    });
    await get().loadSessions();
  },

  cancelSession: async () => {
    await deletePendingTraining();
    set({
      activeSession: null,
      staleSession: null,
      restTimer: 0,
      restTimerExerciseId: null,
      isRestTimerActive: false,
    });
  },

  clearActiveSession: () => {
    set({ activeSession: null });
  },

  // ── 计时器管理 ──────────────────────────────────────────

  pauseSession: () => {
    const { activeSession } = get();
    if (!activeSession || activeSession.timerStatus !== 'running') return;

    const timerFields = pauseTimer(activeSession);
    set({
      activeSession: { ...activeSession, ...timerFields },
      // 暂停训练时清空当前休息计时
      restTimer: 0,
      restTimerExerciseId: null,
      isRestTimerActive: false,
    });
    get()._persistPending();
  },

  continueSession: () => {
    const { activeSession } = get();
    if (!activeSession || activeSession.timerStatus !== 'paused') return;

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    set({
      activeSession: {
        ...activeSession,
        timerStatus: 'running',
        runningSince: nowIso,
        lastCheckpointAt: nowIso,
      },
    });
    get()._persistPending();
  },

  checkpointSession: () => {
    const { activeSession } = get();
    if (!activeSession || activeSession.timerStatus !== 'running') return;

    const timerFields = checkpointTimer(activeSession);
    set({
      activeSession: { ...activeSession, ...timerFields },
    });
    get()._persistPending();
  },

  resolveStaleSession: async (action) => {
    const { staleSession } = get();
    if (!staleSession) return;

    if (action === 'continue') {
      // 排除长时间空白，从现在继续
      const timerFields = continueAfterGap(staleSession);
      set({
        activeSession: { ...staleSession, ...timerFields },
        staleSession: null,
      });
      get()._persistPending();
    } else if (action === 'end') {
      // 结束于最后 checkpoint
      const timerFields = endAtLastCheckpoint(staleSession);
      const completedSession: TrainingSession = {
        ...staleSession,
        ...timerFields,
      };
      await dbAddSession(completedSession);
      await deletePendingTraining();
      set({ staleSession: null });
      await get().loadSessions();
    } else {
      // 放弃训练
      await deletePendingTraining();
      set({ staleSession: null });
    }
  },

  // ── 休息计时器 ──────────────────────────────────────────

  startRestTimer: (seconds, sessionExerciseId) => {
    set({ restTimer: seconds, restTimerExerciseId: sessionExerciseId ?? null, isRestTimerActive: true });
  },

  decrementRestTimer: () => {
    set((state) => {
      if (state.restTimer <= 1) {
        return { restTimer: 0, restTimerExerciseId: null, isRestTimerActive: false };
      }
      return { restTimer: state.restTimer - 1 };
    });
  },

  stopRestTimer: () => {
    set({ restTimer: 0, restTimerExerciseId: null, isRestTimerActive: false });
  },

  // ── 动作管理 ────────────────────────────────────────────

  addExercise: (exercise, phaseId, groupId) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const numSets = 3;
    const sets: SetRecord[] = Array.from({ length: numSets }, (_, i) => ({
      id: generateId(),
      exerciseId: exercise.id,
      setNumber: i + 1,
      reps: 12,
      weight: 0,
      completedAt: '',
    }));

    const newExercise: SessionExercise = {
      id: generateId(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      type: exercise.type,
      sets,
      order: activeSession.exercises.length,
      phaseId: phaseId || 'extra',
      groupId: groupId || 'extra',
    };

    set((state) => ({
      activeSession: state.activeSession ? {
        ...state.activeSession,
        exercises: [...state.activeSession.exercises, newExercise],
      } : null,
    }));
    get()._persistPending();
  },

  removeExercise: (sessionExerciseId) => {
    const { activeSession } = get();
    if (!activeSession) return;

    set((state) => ({
      activeSession: state.activeSession ? {
        ...state.activeSession,
        exercises: state.activeSession.exercises
          .filter((e) => e.id !== sessionExerciseId)
          .map((e, i) => ({ ...e, order: i })),
      } : null,
    }));
    get()._persistPending();
  },

  reorderExercises: (exerciseIds) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const reordered = exerciseIds
      .map((id) => activeSession.exercises.find((e) => e.id === id))
      .filter((e): e is SessionExercise => !!e)
      .map((e, i) => ({ ...e, order: i }));

    set((state) => ({
      activeSession: state.activeSession ? {
        ...state.activeSession,
        exercises: reordered,
      } : null,
    }));
    get()._persistPending();
  },

  // ── 组记录管理 ──────────────────────────────────────────

  addSet: (sessionExerciseId, setData) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const exercise = activeSession.exercises.find((e) => e.id === sessionExerciseId);
    if (!exercise) return;

    const newSet: SetRecord = {
      id: generateId(),
      exerciseId: exercise.exerciseId,
      setNumber: exercise.sets.length + 1,
      weight: setData.weight,
      reps: setData.reps,
      duration: setData.duration,
      distance: setData.distance,
      rpe: setData.rpe,
      completedAt: '',
    };

    set((state) => ({
      activeSession: state.activeSession ? {
        ...state.activeSession,
        exercises: state.activeSession.exercises.map((e) =>
          e.id === sessionExerciseId
            ? { ...e, sets: [...e.sets, newSet] }
            : e
        ),
      } : null,
    }));
    get()._persistPending();
  },

  updateSet: (sessionExerciseId, setId, updates) => {
    const { activeSession } = get();
    if (!activeSession) return;

    set((state) => ({
      activeSession: state.activeSession ? {
        ...state.activeSession,
        exercises: state.activeSession.exercises.map((e) =>
          e.id === sessionExerciseId
            ? {
                ...e,
                sets: e.sets.map((s) =>
                  s.id === setId ? { ...s, ...updates } : s
                ),
              }
            : e
        ),
      } : null,
    }));
    get()._persistPending();
  },

  deleteSet: (sessionExerciseId, setId) => {
    const { activeSession } = get();
    if (!activeSession) return;

    set((state) => ({
      activeSession: state.activeSession ? {
        ...state.activeSession,
        exercises: state.activeSession.exercises.map((e) =>
          e.id === sessionExerciseId
            ? {
                ...e,
                sets: e.sets
                  .filter((s) => s.id !== setId)
                  .map((s, i) => ({ ...s, setNumber: i + 1 })),
              }
            : e
        ),
      } : null,
    }));
    get()._persistPending();
  },

  toggleSetCompleted: (sessionExerciseId, setId) => {
    const { activeSession } = get();
    if (!activeSession) return;

    set((state) => ({
      activeSession: state.activeSession ? {
        ...state.activeSession,
        exercises: state.activeSession.exercises.map((e) =>
          e.id === sessionExerciseId
            ? {
                ...e,
                sets: e.sets.map((s) =>
                  s.id === setId ? { ...s, completedAt: s.completedAt ? '' : getCurrentISOString() } : s
                ),
              }
            : e
        ),
      } : null,
    }));
    get()._persistPending();
  },

  copyLastSet: (sessionExerciseId) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const exercise = activeSession.exercises.find((e) => e.id === sessionExerciseId);
    if (!exercise || exercise.sets.length === 0) return;

    const lastSet = exercise.sets[exercise.sets.length - 1];
    get().addSet(sessionExerciseId, {
      weight: lastSet.weight,
      reps: lastSet.reps,
      duration: lastSet.duration,
      distance: lastSet.distance,
      rpe: lastSet.rpe,
    });
  },

  // ── 历史记录 ────────────────────────────────────────────

  getSessionById: async (id) => {
    return dbGetSessionById(id);
  },

  deleteSession: async (id) => {
    await dbDeleteSession(id);
    await get().loadSessions();
  },

  updateSessionNotes: async (id, notes) => {
    await dbUpdateSession(id, { notes });
    await get().loadSessions();
  },

  // ── 串行持久化 ──────────────────────────────────────────
  // 所有 pending 写入串行执行，防止旧写入覆盖新状态
  // 每次 persist 先 checkpoint（如正在运行），再写入
  _persistPending: async () => {
    const { activeSession } = get();
    if (!activeSession) return;

    // 先 checkpoint 更新计时器状态
    let sessionToSave = activeSession;
    if (activeSession.timerStatus === 'running') {
      const timerFields = checkpointTimer(activeSession);
      sessionToSave = { ...activeSession, ...timerFields };
      set({ activeSession: sessionToSave });
    }

    const pending = {
      ...sessionToSave,
      updatedAt: getCurrentISOString(),
    };

    // 串行写入：将新 promise 追加到队列末尾
    writeQueue = writeQueue.then(() => savePendingTraining(pending)).catch((err) => {
      console.error('[sessionStore] Failed to persist pending training:', err);
    });
  },
}));

const dbGetSessionById = getSessionById;

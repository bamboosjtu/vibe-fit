import { create } from 'zustand';
import type {
  TrainingSession,
  SessionExercise,
  SetRecord,
  TrainingPlan,
  TrainingDay,
  Exercise,
  RestTimerState,
  CardioRecord,
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
import { generateId, getCurrentISOString, toLocalISOString } from '../utils/helpers';
import {
  checkpointTimer,
  pauseTimer,
  endTimer,
  endAtLastCheckpoint,
  continueAfterGap,
  migrateLegacySession,
  isStaleSession,
  IDLE_REST_TIMER,
  startRestTimerState,
  isRestTimerExpired,
  startCardioRecord,
  pauseCardioRecord,
  resumeCardioRecord,
  completeCardioRecord,
} from '../domain/sessionTimer';

interface SessionState {
  sessions: TrainingSession[];
  activeSession: TrainingSession | null;
  staleSession: TrainingSession | null;
  restTimer: RestTimerState;
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

  // 计时器管理
  pauseSession: () => void;
  continueSession: () => void;
  checkpointSession: () => void;
  resolveStaleSession: (action: 'continue' | 'end' | 'discard') => Promise<void>;

  // 休息计时器（基于时间戳）
  startRestTimer: (durationSeconds: number, sessionExerciseId: string) => void;
  stopRestTimer: () => void;
  expireRestTimerIfEnded: () => void;

  // 动作管理
  addExercise: (exercise: Exercise, phaseId?: string, groupId?: string) => void;
  removeExercise: (sessionExerciseId: string) => void;

  // 组记录管理
  addSet: (sessionExerciseId: string, setData: Partial<SetRecord>) => void;
  updateSet: (sessionExerciseId: string, setId: string, updates: Partial<SetRecord>) => void;
  toggleSetCompleted: (sessionExerciseId: string, setId: string) => void;

  // 有氧训练管理
  startCardio: (exercise: Exercise, targetDurationMinutes?: number) => void;
  pauseCardio: (sessionExerciseId: string) => void;
  resumeCardio: (sessionExerciseId: string) => void;
  completeCardio: (
    sessionExerciseId: string,
    metrics?: Partial<Pick<CardioRecord, 'speed' | 'incline' | 'distance' | 'calories' | 'rpe'>>,
  ) => void;
  cancelCardio: (sessionExerciseId: string) => void;
  hasActiveCardio: () => boolean;

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
  restTimer: IDLE_REST_TIMER,
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
              // 从计划复制休息时间，历史记录不受后续计划修改影响
              restSeconds: config.restSeconds,
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
      restTimer: IDLE_REST_TIMER,
    });
    await get().loadSessions();
  },

  // ── 计时器管理 ──────────────────────────────────────────

  pauseSession: () => {
    const { activeSession } = get();
    if (!activeSession || activeSession.timerStatus !== 'running') return;

    const timerFields = pauseTimer(activeSession);
    set({
      activeSession: { ...activeSession, ...timerFields },
      // 暂停训练时清空当前休息计时
      restTimer: IDLE_REST_TIMER,
    });
    get()._persistPending();
  },

  continueSession: () => {
    const { activeSession } = get();
    if (!activeSession || activeSession.timerStatus !== 'paused') return;

    const now = Date.now();
    const nowIso = toLocalISOString(now);
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

  // ── 休息计时器（基于时间戳，setInterval 仅刷新显示） ───

  startRestTimer: (durationSeconds, sessionExerciseId) => {
    // 完成另一动作的组：替换当前休息计时
    set({ restTimer: startRestTimerState(durationSeconds, sessionExerciseId) });
  },

  stopRestTimer: () => {
    set({ restTimer: IDLE_REST_TIMER });
  },

  expireRestTimerIfEnded: () => {
    // 倒计时归零：状态自动切换为 idle
    const { restTimer } = get();
    if (isRestTimerExpired(restTimer)) {
      set({ restTimer: IDLE_REST_TIMER });
    }
  },

  // ── 动作管理 ────────────────────────────────────────────

  addExercise: (exercise, phaseId, groupId) => {
    const { activeSession } = get();
    if (!activeSession) return;

    // 有氧动作不创建组记录，力量动作创建默认 3 组
    const isCardio = exercise.type === 'cardio';
    const sets: SetRecord[] = isCardio ? [] : Array.from({ length: 3 }, (_, i) => ({
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
      // 有氧动作初始为 idle 状态
      cardioRecord: isCardio ? { status: 'idle', elapsedSeconds: 0 } : undefined,
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

  // ── 有氧训练管理（基于时间戳，与训练总计时相同模型） ───

  startCardio: (exercise, targetDurationMinutes) => {
    // 确保整场 activeSession 已存在
    get().ensureSession();

    const { activeSession } = get();
    if (!activeSession) return;

    // 同一时刻最多一个有氧动作运行
    const hasRunning = activeSession.exercises.some(
      (e) => e.cardioRecord?.status === 'running',
    );
    if (hasRunning) return;

    // 当前没有该有氧动作时，先加入 Session
    let sessionExercise = activeSession.exercises.find(
      (e) => e.exerciseId === exercise.id && e.type === 'cardio',
    );

    if (!sessionExercise) {
      get().addExercise(exercise, 'cardio', 'cardio');
      const updated = get().activeSession;
      if (!updated) return;
      sessionExercise = updated.exercises.find(
        (e) => e.exerciseId === exercise.id && e.type === 'cardio',
      );
      if (!sessionExercise) return;
    }

    const targetDurationSeconds = targetDurationMinutes
      ? targetDurationMinutes * 60
      : undefined;

    const cardioRecord = startCardioRecord(targetDurationSeconds);

    set((state) => ({
      activeSession: state.activeSession ? {
        ...state.activeSession,
        exercises: state.activeSession.exercises.map((e) =>
          e.id === sessionExercise!.id ? { ...e, cardioRecord } : e,
        ),
      } : null,
    }));
    get()._persistPending();
  },

  pauseCardio: (sessionExerciseId) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const exercise = activeSession.exercises.find((e) => e.id === sessionExerciseId);
    if (!exercise?.cardioRecord || exercise.cardioRecord.status !== 'running') return;

    const cardioRecord = pauseCardioRecord(exercise.cardioRecord);
    set((state) => ({
      activeSession: state.activeSession ? {
        ...state.activeSession,
        exercises: state.activeSession.exercises.map((e) =>
          e.id === sessionExerciseId ? { ...e, cardioRecord } : e,
        ),
      } : null,
    }));
    get()._persistPending();
  },

  resumeCardio: (sessionExerciseId) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const exercise = activeSession.exercises.find((e) => e.id === sessionExerciseId);
    if (!exercise?.cardioRecord || exercise.cardioRecord.status !== 'paused') return;

    const cardioRecord = resumeCardioRecord(exercise.cardioRecord);
    set((state) => ({
      activeSession: state.activeSession ? {
        ...state.activeSession,
        exercises: state.activeSession.exercises.map((e) =>
          e.id === sessionExerciseId ? { ...e, cardioRecord } : e,
        ),
      } : null,
    }));
    get()._persistPending();
  },

  completeCardio: (sessionExerciseId, metrics) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const exercise = activeSession.exercises.find((e) => e.id === sessionExerciseId);
    if (!exercise?.cardioRecord) return;

    const cardioRecord = completeCardioRecord(exercise.cardioRecord, metrics);
    set((state) => ({
      activeSession: state.activeSession ? {
        ...state.activeSession,
        exercises: state.activeSession.exercises.map((e) =>
          e.id === sessionExerciseId ? { ...e, cardioRecord } : e,
        ),
      } : null,
    }));
    get()._persistPending();
  },

  cancelCardio: (sessionExerciseId) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const cardioRecord: CardioRecord = { status: 'idle', elapsedSeconds: 0 };
    set((state) => ({
      activeSession: state.activeSession ? {
        ...state.activeSession,
        exercises: state.activeSession.exercises.map((e) =>
          e.id === sessionExerciseId ? { ...e, cardioRecord } : e,
        ),
      } : null,
    }));
    get()._persistPending();
  },

  hasActiveCardio: () => {
    const { activeSession } = get();
    if (!activeSession) return false;
    return activeSession.exercises.some(
      (e) => e.cardioRecord?.status === 'running' || e.cardioRecord?.status === 'paused',
    );
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

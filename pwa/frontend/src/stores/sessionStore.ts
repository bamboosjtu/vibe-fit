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
import { DEFAULT_STRENGTH_REST_SECONDS } from '../types';
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
  isStaleSession,
  IDLE_REST_TIMER,
  startRestTimerState,
  isRestTimerExpired,
  startCardioRecord,
  pauseCardioRecord,
  resumeCardioRecord,
  completeCardioRecord,
} from '../domain/sessionTimer';
import { getNativeBridge } from '../services/nativeBridge';

/**
 * 触发原生能力（触感/通知），fire-and-forget。
 * Web 上全部 no-op；原生平台调用对应 Capacitor 插件。
 * 错误静默忽略，不影响业务逻辑。
 */
function fireNative(fn: (bridge: Awaited<ReturnType<typeof getNativeBridge>>) => Promise<void>): void {
  void getNativeBridge().then(fn).catch(() => { /* 静默 */ });
}

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
  addExercise: (
    exercise: Exercise,
    phaseId?: string,
    groupId?: string,
    options?: {
      source?: 'recommended' | 'library';
      targetSets?: number;
      targetReps?: number;
      restSeconds?: number;
    },
  ) => void;
  removeExercise: (sessionExerciseId: string) => void;

  // 组记录管理
  addSet: (sessionExerciseId: string, setData: Partial<SetRecord>) => void;
  updateSet: (sessionExerciseId: string, setId: string, updates: Partial<SetRecord>) => void;
  toggleSetCompleted: (sessionExerciseId: string, setId: string) => void;
  deleteSet: (sessionExerciseId: string, setId: string) => void;

  // 有氧训练管理
  startCardio: (exercise: Exercise, targetDurationMinutes?: number) => void;
  pauseCardio: (sessionExerciseId: string) => void;
  resumeCardio: (sessionExerciseId: string) => void;
  completeCardio: (
    sessionExerciseId: string,
    metrics?: Partial<Pick<CardioRecord, 'speed' | 'incline' | 'distanceMeters' | 'calories' | 'paceSecondsPer500m' | 'resistance' | 'rpe'>>,
  ) => void;
  // 节流更新运行中的有氧指标，防止切换页签/刷新丢失输入
  updateCardioMetrics: (
    sessionExerciseId: string,
    metrics: Partial<Pick<CardioRecord, 'speed' | 'incline' | 'distanceMeters' | 'calories' | 'paceSecondsPer500m' | 'resistance' | 'rpe'>>,
  ) => void;
  cancelCardio: (sessionExerciseId: string) => void;
  hasActiveCardio: () => boolean;

  // 历史记录
  getSessionById: (id: string) => Promise<TrainingSession | undefined>;
  deleteSession: (id: string) => Promise<void>;
  updateSessionNotes: (id: string, notes: string) => Promise<void>;

  // 内部：串行持久化 pending training
  _persistPending: () => Promise<void>;
  /**
   * 立即取消防抖并持久化所有 pending 写入，返回 writeQueue promise 供调用方 await。
   * 用于 pagehide / visibilitychange / 结束训练 / 完成有氧前确保数据落库。
   */
  flushPendingWrites: () => Promise<void>;
  /** 备份导入或清空数据后，清理不应继续保留的运行时训练状态。 */
  resetRuntimeState: () => void;
}

// 串行写入队列，防止旧写入覆盖新状态
let writeQueue: Promise<void> = Promise.resolve();

// 有氧指标输入节流：避免每次按键都触发 _persistPending
// 输入后等待 800ms 无新输入再持久化，防止切换页签/刷新丢失
let cardioMetricsPersistTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleCardioMetricsPersist(): void {
  if (cardioMetricsPersistTimer) {
    clearTimeout(cardioMetricsPersistTimer);
  }
  cardioMetricsPersistTimer = setTimeout(() => {
    cardioMetricsPersistTimer = null;
    // 通过 useSessionStore.getState 获取最新 _persistPending，避免闭包陈旧
    const store = (useSessionStore as unknown as { getState: () => SessionState });
    store.getState()._persistPending();
  }, 800);
}

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
      // 快照计划名：历史搜索不依赖计划后续是否被重命名或删除
      planName: plan?.name,
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

    const session = pending as TrainingSession;

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
    // 原生：结束训练中触感 + 取消可能残留的休息通知
    fireNative((b) => b.hapticMedium());
    fireNative((b) => b.cancelRestTimerNotification());
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
    // 原生：暂停训练时取消休息通知
    fireNative((b) => b.cancelRestTimerNotification());
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
    // 原生：调度休息结束通知（后台/锁屏可响）
    fireNative((b) => b.scheduleRestTimerNotification(durationSeconds));
  },

  stopRestTimer: () => {
    set({ restTimer: IDLE_REST_TIMER });
    // 原生：取消待触发的休息通知
    fireNative((b) => b.cancelRestTimerNotification());
  },

  expireRestTimerIfEnded: () => {
    // 倒计时归零：状态自动切换为 idle
    const { restTimer } = get();
    if (isRestTimerExpired(restTimer)) {
      set({ restTimer: IDLE_REST_TIMER });
    }
  },

  // ── 动作管理 ────────────────────────────────────────────

  addExercise: (exercise, phaseId, groupId, options) => {
    const { activeSession } = get();
    if (!activeSession) return;

    // 有氧动作不创建组记录，力量动作创建默认或继承计划的组数/次数
    const isCardio = exercise.type === 'cardio';
    const numSets = options?.targetSets ?? 3;
    const targetReps = options?.targetReps ?? 12;
    const sets: SetRecord[] = isCardio ? [] : Array.from({ length: numSets }, (_, i) => ({
      id: generateId(),
      exerciseId: exercise.id,
      setNumber: i + 1,
      reps: targetReps,
      // 空重量保持为空（undefined），不自动显示 0
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
      // 力量训练：组间休息时间，优先使用计划配置，回退到默认常量
      restSeconds: isCardio ? undefined : (options?.restSeconds ?? DEFAULT_STRENGTH_REST_SECONDS),
      // 有氧动作初始为 idle 状态
      cardioRecord: isCardio ? { status: 'idle', elapsedSeconds: 0 } : undefined,
      // 动作来源
      source: options?.source,
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

    // 判断当前操作是"完成"还是"取消完成"
    const exercise = activeSession.exercises.find((e) => e.id === sessionExerciseId);
    const targetSet = exercise?.sets.find((s) => s.id === setId);
    const isCompleting = !targetSet?.completedAt;

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
    // 原生：完成组时轻触感
    if (isCompleting) {
      fireNative((b) => b.hapticLight());
    }
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
                // 删除组后重新编号
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
    // 原生：完成有氧记录中触感
    fireNative((b) => b.hapticMedium());
  },

  updateCardioMetrics: (sessionExerciseId, metrics) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const exercise = activeSession.exercises.find((e) => e.id === sessionExerciseId);
    if (!exercise?.cardioRecord) return;
    // 仅 running/paused 状态允许更新指标
    if (exercise.cardioRecord.status !== 'running' && exercise.cardioRecord.status !== 'paused') return;

    set((state) => ({
      activeSession: state.activeSession ? {
        ...state.activeSession,
        exercises: state.activeSession.exercises.map((e) =>
          e.id === sessionExerciseId
            ? { ...e, cardioRecord: { ...e.cardioRecord!, ...metrics } }
            : e,
        ),
      } : null,
    }));
    // 节流持久化：避免每次按键都写库
    scheduleCardioMetricsPersist();
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

  flushPendingWrites: async () => {
    // 取消有氧指标防抖定时器，立即触发持久化
    if (cardioMetricsPersistTimer) {
      clearTimeout(cardioMetricsPersistTimer);
      cardioMetricsPersistTimer = null;
    }
    await get()._persistPending();
    // 等待 writeQueue 中所有 pending 写入完成
    await writeQueue;
  },

  resetRuntimeState: () => {
    if (cardioMetricsPersistTimer) {
      clearTimeout(cardioMetricsPersistTimer);
      cardioMetricsPersistTimer = null;
    }
    set({
      activeSession: null,
      staleSession: null,
      restTimer: IDLE_REST_TIMER,
    });
    fireNative((bridge) => bridge.cancelRestTimerNotification());
  },
}));

const dbGetSessionById = getSessionById;

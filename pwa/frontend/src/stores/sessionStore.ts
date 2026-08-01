import { create } from 'zustand';
import type { 
  TrainingSession, 
  SessionExercise, 
  SetRecord, 
  TrainingPlan, 
  TrainingDay,
  Exercise 
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

interface SessionState {
  sessions: TrainingSession[];
  activeSession: TrainingSession | null;
  trainingTimer: number;
  restTimer: number;
  restTimerExerciseId: string | null;
  isRestTimerActive: boolean;
  isLoading: boolean;
  initialized: boolean;
  _persistPending: () => Promise<void>;

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
  incrementTimer: () => void;
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
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSession: null,
  trainingTimer: 0,
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
    const session: TrainingSession = {
      id: generateId(),
      planId: plan?.id,
      dayId: day?.id,
      dayName: day?.name,
      startedAt: getCurrentISOString(),
      exercises: [],
      notes: '',
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

    set({ activeSession: session, trainingTimer: 0 });
    get()._persistPending();
    return session;
  },

  resumeSession: async () => {
    const pending = await getPendingTraining();
    if (pending) {
      const startedAt = new Date(pending.startedAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        if ('exercises' in pending) {
          // 数据结构迁移：确保旧动作也有 phaseId/groupId
          const exercises = (pending.exercises as SessionExercise[]).map(ex => ({
            ...ex,
            phaseId: ex.phaseId || 'legacy',
            groupId: ex.groupId || 'legacy',
          }));

          set({ 
            activeSession: { ...pending, exercises } as unknown as TrainingSession,
            trainingTimer: Math.floor((now.getTime() - startedAt.getTime()) / 1000)
          });
          return true;
        }
      } else {
        await deletePendingTraining();
      }
    }
    return false;
  },

  ensureSession: (plan, day) => {
    const { activeSession } = get();
    if (activeSession) return activeSession;
    return get().startSession(plan, day);
  },

  _persistPending: async () => {
    const { activeSession } = get();
    if (activeSession) {
      await savePendingTraining({
        ...activeSession,
        updatedAt: getCurrentISOString(),
      });
    }
  },

  endSession: async (notes) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const completedSession: TrainingSession = {
      ...activeSession,
      endedAt: getCurrentISOString(),
      notes: notes || activeSession.notes,
    };

    await dbAddSession(completedSession);
    await deletePendingTraining();
    set({ activeSession: null, trainingTimer: 0, restTimer: 0, restTimerExerciseId: null, isRestTimerActive: false });
    await get().loadSessions();
  },

  cancelSession: async () => {
    await deletePendingTraining();
    set({ activeSession: null, trainingTimer: 0, restTimer: 0, restTimerExerciseId: null, isRestTimerActive: false });
  },

  clearActiveSession: () => {
    set({ activeSession: null });
  },

  incrementTimer: () => {
    if (get().activeSession) {
      set((state) => ({ trainingTimer: state.trainingTimer + 1 }));
    }
  },

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

  addExercise: (exercise, phaseId, groupId) => {
    const { activeSession } = get();
    if (!activeSession) return;

    // 自动添加 3 个初始组
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
          .filter(e => e.id !== sessionExerciseId)
          .map((e, i) => ({ ...e, order: i })),
      } : null,
    }));
    get()._persistPending();
  },

  reorderExercises: (exerciseIds) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const reordered = exerciseIds
      .map(id => activeSession.exercises.find(e => e.id === id))
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

  addSet: (sessionExerciseId, setData) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const exercise = activeSession.exercises.find(e => e.id === sessionExerciseId);
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
        exercises: state.activeSession.exercises.map(e =>
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
        exercises: state.activeSession.exercises.map(e =>
          e.id === sessionExerciseId
            ? {
                ...e,
                sets: e.sets.map(s =>
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
        exercises: state.activeSession.exercises.map(e =>
          e.id === sessionExerciseId
            ? {
                ...e,
                sets: e.sets
                  .filter(s => s.id !== setId)
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
        exercises: state.activeSession.exercises.map(e =>
          e.id === sessionExerciseId
            ? {
                ...e,
                sets: e.sets.map(s =>
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

    const exercise = activeSession.exercises.find(e => e.id === sessionExerciseId);
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
}));

const dbGetSessionById = getSessionById;

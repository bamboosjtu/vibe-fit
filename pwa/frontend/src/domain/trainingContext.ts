import type {
  TrainingPlan,
  TrainingDay,
  TrainingSession,
  TrainingPhase,
  SessionExercise,
} from '../types';

/** 阶段状态：已完成 / 当前 / 未开始 */
export type PhaseStatus = 'completed' | 'current' | 'upcoming';

/** 训练会话整体状态（统一映射 timerStatus + 是否有 activeSession） */
export type SessionRuntimeStatus = 'idle' | 'running' | 'paused' | 'completed';

/** 阶段进度片段 */
export interface PhaseSegment {
  id: string;
  name: string;
  order: number;
  status: PhaseStatus;
  totalSets: number;
  completedSets: number;
}

/**
 * 训练上下文 ViewModel
 *
 * 页面不再从多个业务对象临时拼接训练上下文，统一通过 buildTrainingContext 生成。
 * 缺少计划数据时不生成虚假默认值（字段为 null/undefined）。
 */
export interface TrainingContextViewModel {
  /** 计划名称；自由训练或无计划时为 null */
  planName: string | null;
  /** 训练日名称；自由训练时为 "自由训练" */
  dayName: string | null;
  /** 训练日序号（1-based）；无计划时为 null */
  dayIndex: number | null;
  /** 训练日总数；无计划时为 null */
  totalDays: number | null;
  /** 整场训练状态 */
  runtimeStatus: SessionRuntimeStatus;
  /** 预计时长（分钟）；无法估算时为 null */
  estimatedMinutes: number | null;
  /** 当前阶段序号（1-based）；无阶段时为 null */
  currentPhaseIndex: number | null;
  /** 总阶段数 */
  totalPhases: number;
  /** 阶段进度片段 */
  phases: PhaseSegment[];
  /** 是否为自由训练（无计划） */
  isFreeTraining: boolean;
}

const FREE_TRAINING_DAY_NAME = '自由训练';

/**
 * 判断单个 SessionExercise 是否已完成（所有组都有 completedAt）
 */
function isExerciseComplete(ex: SessionExercise): boolean {
  if (ex.sets.length === 0) {
    // 有氧动作：检查 cardioRecord.status
    if (ex.type === 'cardio') {
      return ex.cardioRecord?.status === 'completed';
    }
    return false;
  }
  return ex.sets.every((s) => Boolean(s.completedAt));
}

/**
 * 判断单个 SessionExercise 是否已开始（至少一组完成 或 有氧已运行/暂停/完成）
 */
function isExerciseStarted(ex: SessionExercise): boolean {
  if (ex.sets.length > 0) {
    return ex.sets.some((s) => Boolean(s.completedAt));
  }
  if (ex.type === 'cardio') {
    return ex.cardioRecord?.status !== undefined && ex.cardioRecord.status !== 'idle';
  }
  return false;
}

/**
 * 计算阶段状态。
 *
 * - 已完成：阶段内所有动作都已完成
 * - 当前：第一个未完成但有动作已开始的阶段；若无已开始阶段，则为第一个未完成阶段
 * - 未开始：其余
 */
function computePhaseStatus(
  phase: TrainingPhase,
  sessionExercises: SessionExercise[],
  hasStartedAny: boolean,
): PhaseStatus {
  const phaseExercises = sessionExercises.filter(
    (ex) => ex.phaseId === phase.id || (!ex.phaseId && ex.groupId === 'legacy'),
  );

  if (phaseExercises.length === 0) {
    // 阶段无动作：若有任何已开始动作，则视为未开始；否则视为未开始
    return 'upcoming';
  }

  const allComplete = phaseExercises.every(isExerciseComplete);
  if (allComplete) return 'completed';

  const anyStarted = phaseExercises.some(isExerciseStarted);
  if (anyStarted) return 'current';

  // 阶段有动作但未开始：若没有任何阶段开始，第一个阶段为当前
  return hasStartedAny ? 'upcoming' : 'current';
}

/**
 * 映射 TrainingSession.timerStatus 到统一状态。
 */
function mapRuntimeStatus(session: TrainingSession | null): SessionRuntimeStatus {
  if (!session) return 'idle';
  if (session.timerStatus === 'completed') return 'completed';
  if (session.timerStatus === 'paused') return 'paused';
  if (session.timerStatus === 'running') return 'running';
  return 'idle';
}

/**
 * 估算预计训练时长（分钟）。
 *
 * 规则：总组数 × 2.15 分钟/组，向上取整到 5 分钟，最小 30 分钟。
 * 无组数信息时返回 null。
 */
function estimateMinutes(day: TrainingDay | null): number | null {
  if (!day?.phases) return null;
  const totalSets = day.phases.reduce(
    (phaseTotal, phase) =>
      phaseTotal + phase.groups.reduce((groupTotal, g) => groupTotal + (g.targetTotalSets ?? 0), 0),
    0,
  );
  if (totalSets <= 0) return null;
  return Math.max(30, Math.round((totalSets * 2.15) / 5) * 5);
}

/**
 * 构建训练上下文 ViewModel。
 *
 * @param currentPlan 当前计划；自由训练时为 null
 * @param todayDay 今日训练日；自由训练时为 null
 * @param activeSession 活动训练会话；无活动时为 null
 */
export function buildTrainingContext(
  currentPlan: TrainingPlan | null,
  todayDay: TrainingDay | null,
  activeSession: TrainingSession | null,
): TrainingContextViewModel {
  const isFreeTraining = !currentPlan || !todayDay;
  const runtimeStatus = mapRuntimeStatus(activeSession);

  // 自由训练：无计划/训练日数据
  if (isFreeTraining) {
    return {
      planName: null,
      dayName: activeSession?.dayName ?? FREE_TRAINING_DAY_NAME,
      dayIndex: null,
      totalDays: null,
      runtimeStatus,
      estimatedMinutes: null,
      currentPhaseIndex: null,
      totalPhases: 0,
      phases: [],
      isFreeTraining: true,
    };
  }

  // 计划训练
  const totalDays = currentPlan.days.length;
  const dayIndex = currentPlan.currentDayIndex + 1;
  const estimatedMinutes = estimateMinutes(todayDay);

  const sessionExercises = activeSession?.exercises ?? [];
  const hasStartedAny = sessionExercises.some(isExerciseStarted);

  const phases: PhaseSegment[] = (todayDay.phases ?? []).map((phase) => {
    const phaseExercises = sessionExercises.filter(
      (ex) => ex.phaseId === phase.id || (!ex.phaseId && ex.groupId === 'legacy'),
    );
    const totalSets = phaseExercises.reduce((sum, ex) => sum + ex.sets.length, 0);
    const completedSets = phaseExercises.reduce(
      (sum, ex) => sum + ex.sets.filter((s) => Boolean(s.completedAt)).length,
      0,
    );
    return {
      id: phase.id,
      name: phase.name,
      order: phase.order,
      status: computePhaseStatus(phase, sessionExercises, hasStartedAny),
      totalSets,
      completedSets,
    };
  });

  // 当前阶段序号
  const currentPhaseIdx = phases.findIndex((p) => p.status === 'current');
  const currentPhaseIndex = currentPhaseIdx >= 0 ? currentPhaseIdx + 1 : null;

  return {
    planName: currentPlan.name,
    dayName: todayDay.name,
    dayIndex,
    totalDays,
    runtimeStatus,
    estimatedMinutes,
    currentPhaseIndex,
    totalPhases: phases.length,
    phases,
    isFreeTraining: false,
  };
}

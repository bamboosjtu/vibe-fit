import type {
  TrainingPlan,
  TrainingDay,
  TrainingSession,
  TrainingPhase,
  ExerciseGroup,
  SessionExercise,
} from '../types';

/** 阶段状态：已完成 / 当前 / 未开始 */
export type PhaseStatus = 'completed' | 'current' | 'upcoming';

/** 训练会话整体状态（统一映射 timerStatus + 是否有 activeSession） */
export type SessionRuntimeStatus = 'idle' | 'running' | 'paused' | 'completed';

/**
 * 阶段进度片段（用于顶部进度条）。
 */
export interface PhaseSegment {
  id: string;
  name: string;
  order: number;
  status: PhaseStatus;
  totalSets: number;
  completedSets: number;
}

/**
 * 阶段 ViewModel（用于 StrengthSection 阶段卡片）。
 *
 * 阶段完成状态在 domain 层计算一次，UI 不再重复计算。
 */
export interface PhaseViewModel {
  id: string;
  name: string;
  order: number;
  status: PhaseStatus;
  /** 已选动作组的数量 */
  selectedGroupCount: number;
  /** 必选动作组总数（阶段内所有 group） */
  requiredGroupCount: number;
  /** 已完成组数 */
  completedSets: number;
  /** 目标总组数（来自 group.targetTotalSets 之和；无可为 0） */
  targetSets: number;
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
  /** 预计时长（分钟）；无法估算时为 null。值为基于组数的估算，非计划字段 */
  estimatedMinutes: number | null;
  /** 当前阶段序号（1-based）；无阶段或全部完成时为 null */
  currentPhaseIndex: number | null;
  /** 总阶段数 */
  totalPhases: number;
  /** 阶段进度片段（顶部进度条使用） */
  phases: PhaseSegment[];
  /** 阶段 ViewModel 列表（阶段卡片使用，与 phases 同源） */
  phaseViewModels: PhaseViewModel[];
  /** 是否为自由训练（无计划） */
  isFreeTraining: boolean;
}

const FREE_TRAINING_DAY_NAME = '自由训练';

/**
 * 判断单个 SessionExercise 是否已完成（所有组都有 completedAt）。
 * 力量动作要求所有组完成；有氧动作要求 cardioRecord.status === 'completed'。
 */
function isExerciseComplete(ex: SessionExercise): boolean {
  if (ex.sets.length === 0) {
    if (ex.type === 'cardio') {
      return ex.cardioRecord?.status === 'completed';
    }
    return false;
  }
  return ex.sets.every((s) => Boolean(s.completedAt));
}

/**
 * 判断单个 SessionExercise 是否已开始。
 * 力量动作：至少一组完成；有氧动作：cardioRecord 已离开 idle 状态。
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
 * 判断单个 SessionExercise 是否属于指定 group。
 * 仅按 groupId 严格匹配，不再做 legacy 兼容。
 */
function belongsToGroup(ex: SessionExercise, group: ExerciseGroup): boolean {
  return ex.groupId === group.id;
}

/**
 * 判断单个 group 是否已选动作（sessionExercises 中存在属于该 group 的动作）。
 */
function isGroupSelected(group: ExerciseGroup, sessionExercises: SessionExercise[]): boolean {
  return sessionExercises.some((ex) => belongsToGroup(ex, group));
}

/**
 * 判断单个 group 是否已完成：
 *  - 已选至少一个动作；
 *  - 所有已选动作的所有组都已完成（或为有氧且 cardioRecord.status === 'completed'）；
 *  - 已完成组数 >= group.targetTotalSets（若配置了目标组数）。
 */
function isGroupCompleted(group: ExerciseGroup, sessionExercises: SessionExercise[]): boolean {
  const groupExercises = sessionExercises.filter((ex) => belongsToGroup(ex, group));
  if (groupExercises.length === 0) return false;

  const allSelectedCompleted = groupExercises.every(isExerciseComplete);
  if (!allSelectedCompleted) return false;

  // 若配置了 targetTotalSets，要求完成组数达到该门槛
  const requiredSets = group.targetTotalSets ?? 0;
  if (requiredSets > 0) {
    const completedSets = groupExercises.reduce(
      (total, ex) => total + ex.sets.filter((s) => Boolean(s.completedAt)).length,
      0,
    );
    return completedSets >= requiredSets;
  }

  return true;
}

/**
 * 判断单个 group 是否已开始（至少一个动作已开始）。
 */
function isGroupStarted(group: ExerciseGroup, sessionExercises: SessionExercise[]): boolean {
  const groupExercises = sessionExercises.filter((ex) => belongsToGroup(ex, group));
  return groupExercises.some(isExerciseStarted);
}

/**
 * 计算单个阶段的"完成 / 已开始"原始状态（不决定 current）。
 */
interface PhaseRawState {
  phase: TrainingPhase;
  /** 所有必选 group 都已选动作且所有动作完成 */
  completed: boolean;
  /** 至少一个 group 已开始（即至少一个动作已开始） */
  started: boolean;
}

function computePhaseRawState(
  phase: TrainingPhase,
  sessionExercises: SessionExercise[],
): PhaseRawState {
  const groups = phase.groups ?? [];
  if (groups.length === 0) {
    return { phase, completed: false, started: false };
  }
  // 阶段完成 = 所有必选 group 都已完成
  const completed = groups.every((g) => isGroupCompleted(g, sessionExercises));
  // 阶段已开始 = 任一 group 已开始
  const started = groups.some((g) => isGroupStarted(g, sessionExercises));
  return { phase, completed, started };
}

/**
 * 两遍计算：先求出每个阶段的 completed/started，再统一选择唯一的 current 阶段。
 *
 * 1. 优先选择第一个"已开始但未完成"的阶段作为 current；
 * 2. 若没有，则选第一个未完成阶段作为 current（训练尚未真正开始时默认第一个）；
 * 3. 其他未完成阶段为 upcoming；
 * 4. 所有阶段完成后，不再存在 current。
 */
function resolvePhaseStatuses(rawStates: PhaseRawState[]): PhaseStatus[] {
  const statuses: PhaseStatus[] = rawStates.map((s) => (s.completed ? 'completed' : 'upcoming'));

  // 1. 第一个"已开始但未完成"
  let currentIdx = rawStates.findIndex((s) => s.started && !s.completed);

  // 2. 若无，选第一个未完成
  if (currentIdx === -1) {
    currentIdx = rawStates.findIndex((s) => !s.completed);
  }

  if (currentIdx >= 0) {
    statuses[currentIdx] = 'current';
  }
  return statuses;
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
 * 规则：总目标组数 × 2.15 分钟/组，向上取整到 5 分钟，最小 30 分钟。
 * 无组数信息时返回 null。
 *
 * 注意：此值为算法估值，非计划显式字段。后续若计划新增 estimatedMinutes 字段，应优先使用计划值。
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
      phaseViewModels: [],
      isFreeTraining: true,
    };
  }

  // 计划训练
  const totalDays = currentPlan.days.length;
  const dayIndex = currentPlan.currentDayIndex + 1;
  const estimatedMinutes = estimateMinutes(todayDay);

  const sessionExercises = activeSession?.exercises ?? [];
  const phasesSource = todayDay.phases ?? [];

  // 第一遍：计算每个阶段的原始状态
  const rawStates = phasesSource.map((phase) => computePhaseRawState(phase, sessionExercises));
  // 第二遍：统一决定 current
  const statuses = resolvePhaseStatuses(rawStates);

  // 构建两套片段（顶部进度条 + 阶段卡片），同源同 status
  const phases: PhaseSegment[] = phasesSource.map((phase, idx) => {
    const phaseExercises = sessionExercises.filter((ex) => ex.phaseId === phase.id);
    const totalSets = phaseExercises.reduce((sum, ex) => sum + ex.sets.length, 0);
    const completedSets = phaseExercises.reduce(
      (sum, ex) => sum + ex.sets.filter((s) => Boolean(s.completedAt)).length,
      0,
    );
    return {
      id: phase.id,
      name: phase.name,
      order: phase.order,
      status: statuses[idx],
      totalSets,
      completedSets,
    };
  });

  const phaseViewModels: PhaseViewModel[] = phasesSource.map((phase, idx) => {
    const groups = phase.groups ?? [];
    const selectedGroupCount = groups.filter((g) => isGroupSelected(g, sessionExercises)).length;
    const requiredGroupCount = groups.length;
    const targetSets = groups.reduce((sum, g) => sum + (g.targetTotalSets ?? 0), 0);
    const phaseExercises = sessionExercises.filter((ex) => ex.phaseId === phase.id);
    const completedSets = phaseExercises.reduce(
      (sum, ex) => sum + ex.sets.filter((s) => Boolean(s.completedAt)).length,
      0,
    );
    return {
      id: phase.id,
      name: phase.name,
      order: phase.order,
      status: statuses[idx],
      selectedGroupCount,
      requiredGroupCount,
      completedSets,
      targetSets,
    };
  });

  // 当前阶段序号
  const currentPhaseIdx = statuses.findIndex((s) => s === 'current');
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
    phaseViewModels,
    isFreeTraining: false,
  };
}

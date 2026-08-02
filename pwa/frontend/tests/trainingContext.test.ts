import { describe, it, expect } from 'vitest';
import { buildTrainingContext } from '../src/domain/trainingContext';
import type {
  TrainingPlan,
  TrainingDay,
  TrainingSession,
  SessionExercise,
  ExerciseGroup,
  PlanExerciseConfig,
} from '../src/types';

// ── 测试夹具 ──────────────────────────────────────────────

function makeConfig(exerciseId: string, name: string, targetSets = 4): PlanExerciseConfig {
  return {
    exerciseId,
    exerciseName: name,
    type: 'strength',
    targetSets,
    targetReps: 12,
    restSeconds: 90,
    order: 0,
  };
}

function makeGroup(
  id: string,
  name: string,
  available: PlanExerciseConfig[],
  selected: PlanExerciseConfig[],
  targetTotalSets?: number,
): ExerciseGroup {
  return {
    id,
    name,
    availableExercises: available,
    selectedExercises: selected,
    targetTotalSets,
    order: 0,
  };
}

function makeSessionExercise(
  exerciseId: string,
  groupId: string,
  phaseId: string,
  setsCompleted: number,
  totalSets: number,
): SessionExercise {
  const sets = Array.from({ length: totalSets }, (_, i) => ({
    id: `set-${exerciseId}-${i}`,
    exerciseId,
    setNumber: i + 1,
    reps: 12,
    weight: 50,
    completedAt: i < setsCompleted ? '2026-08-02T12:00:00.000Z' : '',
  }));
  return {
    id: `se-${exerciseId}`,
    exerciseId,
    exerciseName: exerciseId,
    type: 'strength' as const,
    sets,
    order: 0,
    phaseId,
    groupId,
    restSeconds: 90,
  };
}

function makeDay(phases: ExerciseGroup[][]): TrainingDay {
  return {
    id: 'day-1',
    name: '测试日',
    phases: phases.map((groups, i) => ({
      id: `phase-${i + 1}`,
      name: `阶段${i + 1}`,
      groups,
      order: i,
    })),
    isActive: true,
    order: 0,
  };
}

function makePlan(day: TrainingDay): TrainingPlan {
  return {
    id: 'plan-1',
    name: '测试计划',
    description: '',
    days: [day],
    isCurrent: true,
    isActive: true,
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
  };
}

function makeSession(exercises: SessionExercise[]): TrainingSession {
  return {
    id: 'session-1',
    startedAt: '2026-08-02T12:00:00.000Z',
    exercises,
    notes: '',
    timerStatus: 'running',
    elapsedSeconds: 0,
    runningSince: '2026-08-02T12:00:00.000Z',
    lastCheckpointAt: '2026-08-02T12:00:00.000Z',
  };
}

// ── 测试用例 ──────────────────────────────────────────────

describe('buildTrainingContext - 阶段完成语义', () => {
  it('缺少必选 group 时，阶段不完成', () => {
    const config = makeConfig('pull-up', '引体向上', 4);
    const group1 = makeGroup('g1', '下拉', [config], [config], 4);
    const group2 = makeGroup('g2', '划船', [makeConfig('barbell-row', '划船', 4)], [], 4);
    const day = makeDay([[group1, group2]]);
    const plan = makePlan(day);

    // group1 完成 4 组，group2 未选动作
    const session = makeSession([
      makeSessionExercise('pull-up', 'g1', 'phase-1', 4, 4),
    ]);

    const ctx = buildTrainingContext(plan, day, session);
    expect(ctx.phaseViewModels[0].status).not.toBe('completed');
  });

  it('所有动作完成但未达到 targetTotalSets 时，阶段不完成', () => {
    const config = makeConfig('pull-up', '引体向上', 4);
    // targetTotalSets = 8，但只选了一个动作且只完成 4 组
    const group = makeGroup('g1', '下拉', [config], [config], 8);
    const day = makeDay([[group]]);
    const plan = makePlan(day);

    const session = makeSession([
      makeSessionExercise('pull-up', 'g1', 'phase-1', 4, 4),
    ]);

    const ctx = buildTrainingContext(plan, day, session);
    expect(ctx.phaseViewModels[0].status).not.toBe('completed');
  });

  it('所有必选 group 已选动作且完成组数达到 targetTotalSets 时，阶段完成', () => {
    const config = makeConfig('pull-up', '引体向上', 4);
    const group = makeGroup('g1', '下拉', [config], [config], 4);
    const day = makeDay([[group]]);
    const plan = makePlan(day);

    const session = makeSession([
      makeSessionExercise('pull-up', 'g1', 'phase-1', 4, 4),
    ]);

    const ctx = buildTrainingContext(plan, day, session);
    expect(ctx.phaseViewModels[0].status).toBe('completed');
  });

  it('未配置 targetTotalSets 时，所有已选动作完成即视为阶段完成', () => {
    const config = makeConfig('pull-up', '引体向上', 4);
    const group = makeGroup('g1', '下拉', [config], [config]);
    const day = makeDay([[group]]);
    const plan = makePlan(day);

    const session = makeSession([
      makeSessionExercise('pull-up', 'g1', 'phase-1', 4, 4),
    ]);

    const ctx = buildTrainingContext(plan, day, session);
    expect(ctx.phaseViewModels[0].status).toBe('completed');
  });
});

describe('buildTrainingContext - 当前阶段唯一性', () => {
  it('同时最多一个阶段为 current', () => {
    const config1 = makeConfig('pull-up', '引体向上', 4);
    const config2 = makeConfig('bench-press', '卧推', 4);
    const group1 = makeGroup('g1', '下拉', [config1], [config1], 4);
    const group2 = makeGroup('g2', '推', [config2], [config2], 4);
    const day = makeDay([[group1], [group2]]);
    const plan = makePlan(day);

    // 两个阶段都未完成
    const session = makeSession([
      makeSessionExercise('pull-up', 'g1', 'phase-1', 0, 4),
      makeSessionExercise('bench-press', 'g2', 'phase-2', 0, 4),
    ]);

    const ctx = buildTrainingContext(plan, day, session);
    const currentCount = ctx.phaseViewModels.filter(p => p.status === 'current').length;
    expect(currentCount).toBe(1);
  });

  it('所有阶段完成后，不再存在 current', () => {
    const config1 = makeConfig('pull-up', '引体向上', 4);
    const config2 = makeConfig('bench-press', '卧推', 4);
    const group1 = makeGroup('g1', '下拉', [config1], [config1], 4);
    const group2 = makeGroup('g2', '推', [config2], [config2], 4);
    const day = makeDay([[group1], [group2]]);
    const plan = makePlan(day);

    const session = makeSession([
      makeSessionExercise('pull-up', 'g1', 'phase-1', 4, 4),
      makeSessionExercise('bench-press', 'g2', 'phase-2', 4, 4),
    ]);

    const ctx = buildTrainingContext(plan, day, session);
    const currentCount = ctx.phaseViewModels.filter(p => p.status === 'current').length;
    expect(currentCount).toBe(0);
    expect(ctx.phaseViewModels.every(p => p.status === 'completed')).toBe(true);
  });

  it('完成当前阶段后，下一个未完成阶段变为 current', () => {
    const config1 = makeConfig('pull-up', '引体向上', 4);
    const config2 = makeConfig('bench-press', '卧推', 4);
    const group1 = makeGroup('g1', '下拉', [config1], [config1], 4);
    const group2 = makeGroup('g2', '推', [config2], [config2], 4);
    const day = makeDay([[group1], [group2]]);
    const plan = makePlan(day);

    // phase-1 已完成，phase-2 未完成
    const session = makeSession([
      makeSessionExercise('pull-up', 'g1', 'phase-1', 4, 4),
      makeSessionExercise('bench-press', 'g2', 'phase-2', 0, 4),
    ]);

    const ctx = buildTrainingContext(plan, day, session);
    expect(ctx.phaseViewModels[0].status).toBe('completed');
    expect(ctx.phaseViewModels[1].status).toBe('current');
  });

  it('优先选择"已开始但未完成"的阶段为 current', () => {
    const config1 = makeConfig('pull-up', '引体向上', 4);
    const config2 = makeConfig('bench-press', '卧推', 4);
    const config3 = makeConfig('squat', '深蹲', 4);
    const group1 = makeGroup('g1', '下拉', [config1], [config1], 4);
    const group2 = makeGroup('g2', '推', [config2], [config2], 4);
    const group3 = makeGroup('g3', '腿', [config3], [config3], 4);
    const day = makeDay([[group1], [group2], [group3]]);
    const plan = makePlan(day);

    // phase-1 已完成，phase-2 已开始但未完成，phase-3 未开始
    const session = makeSession([
      makeSessionExercise('pull-up', 'g1', 'phase-1', 4, 4),
      makeSessionExercise('bench-press', 'g2', 'phase-2', 2, 4),
      makeSessionExercise('squat', 'g3', 'phase-3', 0, 4),
    ]);

    const ctx = buildTrainingContext(plan, day, session);
    expect(ctx.phaseViewModels[1].status).toBe('current');
    expect(ctx.phaseViewModels[2].status).toBe('upcoming');
  });
});

describe('buildTrainingContext - PhaseViewModel 字段', () => {
  it('selectedGroupCount 和 requiredGroupCount 正确计算', () => {
    const config1 = makeConfig('pull-up', '引体向上', 4);
    const config2 = makeConfig('barbell-row', '划船', 4);
    const group1 = makeGroup('g1', '下拉', [config1], [config1], 4);
    const group2 = makeGroup('g2', '划船', [config2], [], 4);
    const day = makeDay([[group1, group2]]);
    const plan = makePlan(day);

    const session = makeSession([
      makeSessionExercise('pull-up', 'g1', 'phase-1', 4, 4),
    ]);

    const ctx = buildTrainingContext(plan, day, session);
    const vm = ctx.phaseViewModels[0];
    expect(vm.selectedGroupCount).toBe(1);
    expect(vm.requiredGroupCount).toBe(2);
    expect(vm.targetSets).toBe(8); // 4 + 4
  });

  it('completedSets 正确统计已完成组数', () => {
    const config = makeConfig('pull-up', '引体向上', 4);
    const group = makeGroup('g1', '下拉', [config], [config], 4);
    const day = makeDay([[group]]);
    const plan = makePlan(day);

    const session = makeSession([
      makeSessionExercise('pull-up', 'g1', 'phase-1', 3, 4),
    ]);

    const ctx = buildTrainingContext(plan, day, session);
    expect(ctx.phaseViewModels[0].completedSets).toBe(3);
  });
});

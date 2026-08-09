// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ExerciseGroup, PlanExerciseConfig } from '../src/types';

// Mock exerciseAssets 以避免触发图片资源加载
vi.mock('../src/constants/exerciseAssets', () => ({
  getExerciseImagePath: () => null,
  PLACEHOLDER_BG: 'rgba(0,0,0,0.05)',
  CARDIO_NO_ASSET_IDS: new Set(['treadmill', 'elliptical', 'rowing-machine']),
}));

// Mock ExerciseImage 以避免加载真实图片
vi.mock('../src/components/ExerciseImage', () => ({
  ExerciseImage: () => null,
}));

// Mock @mui/icons-material：返回空组件，避免 EMFILE（MUI icons 包含数千个文件）
vi.mock('@mui/icons-material', async () => {
  const React = await import('react');
  const Stub: React.FC<React.HTMLAttributes<HTMLSpanElement>> = (props) =>
    React.createElement('span', { ...props, 'data-testid': 'mui-icon' });
  // 列出 ExerciseSelector 实际使用的所有图标名
  return {
    Search: Stub,
    ExpandMoreRounded: Stub,
    Check: Stub,
  };
});

import { ExerciseSelector, type SelectorContext } from '../src/components/ExerciseSelector';

// 构造下拉组（背 - 下拉）的推荐动作
function buildGroup(
  overrides: Partial<ExerciseGroup> & { availableExercises?: PlanExerciseConfig[] } = {},
): ExerciseGroup {
  const available: PlanExerciseConfig[] = overrides.availableExercises ?? [
    { exerciseId: 'pull-up', exerciseName: '引体向上', type: 'strength', targetSets: 4, targetReps: 8, restSeconds: 90, order: 0 },
    { exerciseId: 'lat-pulldown', exerciseName: '高位下拉', type: 'strength', targetSets: 4, targetReps: 10, restSeconds: 75, order: 1 },
    { exerciseId: 'machine-pulldown', exerciseName: '器械下拉', type: 'strength', targetSets: 3, targetReps: 12, restSeconds: 60, order: 2 },
  ];
  return {
    id: 'group-pulldown',
    name: '下拉',
    availableExercises: available,
    selectedExercises: [],
    order: 0,
    ...overrides,
  };
}

function buildContext(overrides: Partial<SelectorContext> = {}): SelectorContext {
  return {
    phaseId: 'phase-back',
    groupId: 'group-pulldown',
    groupName: '下拉',
    group: buildGroup(),
    addedExerciseIds: [],
    ...overrides,
  };
}

function renderSelector(props: Partial<Parameters<typeof ExerciseSelector>[0]> = {}) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <ExerciseSelector
      open={props.open ?? true}
      context={props.context ?? buildContext()}
      onClose={onClose}
      onSelect={onSelect}
      {...props}
    />,
  );
  return { ...utils, onSelect, onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ExerciseSelector - 推荐列表', () => {
  it('推荐列表数据严格来自 group.availableExercises', () => {
    const context = buildContext({
      group: buildGroup({
        availableExercises: [
          { exerciseId: 'pull-up', exerciseName: '引体向上', type: 'strength', targetSets: 4, targetReps: 8, order: 0 },
          { exerciseId: 'lat-pulldown', exerciseName: '高位下拉', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
        ],
      }),
    });
    renderSelector({ context });

    // 应该只展示 availableExercises 中的 2 个动作
    expect(screen.queryByTestId('exercise-option-pull-up')).not.toBeNull();
    expect(screen.queryByTestId('exercise-option-lat-pulldown')).not.toBeNull();
    // 不应该展示未在 availableExercises 中的动作
    expect(screen.queryByTestId('exercise-option-machine-pulldown')).toBeNull();
    // 不应该展示其他类型动作
    expect(screen.queryByTestId('exercise-option-treadmill')).toBeNull();
  });

  it('推荐动作展示计划组数和次数', () => {
    renderSelector();

    const option = screen.getByTestId('exercise-option-pull-up');
    expect(option.textContent).toContain('4');
    expect(option.textContent).toContain('8');
  });

  it('推荐动作为空时展示空状态', () => {
    const context = buildContext({
      group: buildGroup({ availableExercises: [] }),
    });
    renderSelector({ context });

    expect(screen.getByText('该组暂无推荐动作')).not.toBeNull();
  });

  it('从推荐列表添加动作：onSelect 收到 source=recommended 和完整 config', () => {
    const { onSelect } = renderSelector();

    fireEvent.click(screen.getByTestId('exercise-option-pull-up'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    const [exercise, source, config] = onSelect.mock.calls[0];
    expect(exercise.id).toBe('pull-up');
    expect(source).toBe('recommended');
    expect(config).toBeDefined();
    expect(config?.targetSets).toBe(4);
    expect(config?.targetReps).toBe(8);
    expect(config?.restSeconds).toBe(90);
  });
});

describe('ExerciseSelector - 已添加动作去重', () => {
  it('已添加到当前动作组的动作不可重复添加', () => {
    const onSelect = vi.fn();
    const context = buildContext({ addedExerciseIds: ['pull-up'] });
    render(
      <ExerciseSelector
        open={true}
        context={context}
        onClose={vi.fn()}
        onSelect={onSelect}
      />,
    );

    const option = screen.getByTestId('exercise-option-pull-up');
    // 应该展示"已添加"标签
    expect(option.textContent).toContain('已添加');
    // 点击禁用项不应触发 onSelect（ListItemButton disabled 后 onClick 不触发）
    fireEvent.click(option);
    expect(onSelect).not.toHaveBeenCalled();
  });

});

describe('ExerciseSelector - 全局动作库', () => {
  it('默认不展示全局动作库，点击"搜索更多动作"后才加载', () => {
    renderSelector();

    // 初始：未展示搜索框
    expect(screen.queryByTestId('exercise-search-input')).toBeNull();
    // 推荐列表存在
    expect(screen.queryByTestId('exercise-option-pull-up')).not.toBeNull();

    // 点击"搜索更多动作"
    fireEvent.click(screen.getByTestId('show-all-exercises-button'));

    // 搜索框出现
    expect(screen.queryByTestId('exercise-search-input')).not.toBeNull();
    // 推荐列表的"搜索更多动作"按钮消失（切换到全局视图）
    expect(screen.queryByTestId('show-all-exercises-button')).toBeNull();
  });

  it('从全局动作库添加动作：source=library', () => {
    const { onSelect } = renderSelector();

    fireEvent.click(screen.getByTestId('show-all-exercises-button'));
    // 选择一个未在推荐列表中的动作（如杠铃俯身划船）
    fireEvent.click(screen.getByTestId('exercise-option-barbell-row'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    const [exercise, source, config] = onSelect.mock.calls[0];
    expect(exercise.id).toBe('barbell-row');
    expect(source).toBe('library');
    // 全局动作库不附带计划配置
    expect(config).toBeUndefined();
  });

  it('全局搜索结果支持名称筛选', () => {
    renderSelector();

    fireEvent.click(screen.getByTestId('show-all-exercises-button'));
    const input = screen.getByTestId('exercise-search-input').querySelector('input')!;
    fireEvent.change(input, { target: { value: '跑步机' } });

    // 只剩跑步机
    expect(screen.queryByTestId('exercise-option-treadmill')).not.toBeNull();
    expect(screen.queryByTestId('exercise-option-barbell-row')).toBeNull();
  });

  it('全局动作库中已添加到当前组的动作也展示"已添加"', () => {
    const context = buildContext({ addedExerciseIds: ['pull-up'] });
    renderSelector({ context });

    fireEvent.click(screen.getByTestId('show-all-exercises-button'));
    const option = screen.getByTestId('exercise-option-pull-up');
    expect(option.textContent).toContain('已添加');
  });
});

describe('ExerciseSelector - 切换动作组上下文', () => {
  it('切换动作组后清空搜索状态', () => {
    const { rerender } = renderSelector();

    // 进入全局搜索，输入关键词
    fireEvent.click(screen.getByTestId('show-all-exercises-button'));
    const input = screen.getByTestId('exercise-search-input').querySelector('input')!;
    fireEvent.change(input, { target: { value: '跑步机' } });
    expect(input.value).toBe('跑步机');

    // 切换到另一个动作组（划船组）
    const newRowContext: SelectorContext = {
      phaseId: 'phase-back',
      groupId: 'group-row',
      groupName: '划船',
      group: buildGroup({
        id: 'group-row',
        name: '划船',
        availableExercises: [
          { exerciseId: 'barbell-row', exerciseName: '杠铃俯身划船', type: 'strength', targetSets: 4, targetReps: 8, order: 0 },
        ],
      }),
      addedExerciseIds: [],
    };

    rerender(
      <ExerciseSelector
        open={true}
        context={newRowContext}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    // 应该回到推荐列表视图（不再是全局搜索）
    expect(screen.queryByTestId('exercise-search-input')).toBeNull();
    expect(screen.queryByTestId('show-all-exercises-button')).not.toBeNull();
    // 新组的推荐动作出现
    expect(screen.queryByTestId('exercise-option-barbell-row')).not.toBeNull();
  });

  it('重新打开选择器时恢复推荐列表视图', () => {
    const { rerender } = renderSelector({ open: true });

    // 进入全局搜索
    fireEvent.click(screen.getByTestId('show-all-exercises-button'));
    expect(screen.queryByTestId('exercise-search-input')).not.toBeNull();

    // 关闭选择器
    rerender(
      <ExerciseSelector
        open={false}
        context={buildContext()}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    // 重新打开
    rerender(
      <ExerciseSelector
        open={true}
        context={buildContext()}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    // 应该回到推荐列表，不是全局搜索
    expect(screen.queryByTestId('exercise-search-input')).toBeNull();
    expect(screen.queryByTestId('exercise-option-pull-up')).not.toBeNull();
  });
});

describe('ExerciseSelector - 显式上下文', () => {
  it('无 context 时不展示推荐列表，直接进入全局搜索', () => {
    render(
      <ExerciseSelector
        open={true}
        context={null}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    // 无 context：不应展示"搜索更多动作"按钮（已经在全局视图）
    expect(screen.queryByTestId('show-all-exercises-button')).toBeNull();
    // 应直接展示搜索框
    expect(screen.queryByTestId('exercise-search-input')).not.toBeNull();
  });

  it('标题展示当前动作组名称', () => {
    const context = buildContext({ groupName: '下拉' });
    renderSelector({ context });
    expect(screen.getByText('选择下拉动作')).not.toBeNull();
  });
});

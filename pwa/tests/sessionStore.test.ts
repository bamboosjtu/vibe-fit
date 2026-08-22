import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 使用 vi.hoisted 保证 mock 工厂能拿到这些值（vi.mock 会被提升到文件顶部）
const { MOCK_NOW, MOCK_NOW_ISO, dbMocks } = vi.hoisted(() => {
  const now = new Date('2026-08-02T12:00:00.000Z').getTime();
  return {
    MOCK_NOW: now,
    MOCK_NOW_ISO: new Date(now).toISOString(),
    dbMocks: {
      getAllSessions: vi.fn(),
      getSessionById: vi.fn(),
      addSession: vi.fn(),
      updateSession: vi.fn(),
      deleteSession: vi.fn(),
      getPendingTraining: vi.fn(),
      savePendingTraining: vi.fn(),
      deletePendingTraining: vi.fn(),
    },
  };
});

vi.mock('../src/db', () => dbMocks);

// Mock nativeBridge：测试环境为 Web，fireNative 应为 no-op
vi.mock('../src/services/nativeBridge', () => ({
  getNativeBridge: vi.fn().mockResolvedValue({
    scheduleRestTimerNotification: vi.fn(),
    cancelRestTimerNotification: vi.fn(),
    hapticLight: vi.fn(),
    hapticMedium: vi.fn(),
    exportBackupFile: vi.fn(),
    importBackupFile: vi.fn(),
  }),
}));

vi.mock('../src/utils/helpers', () => ({
  generateId: vi.fn(() => 'test-id-' + Math.random().toString(36).slice(2, 8)),
  getCurrentISOString: vi.fn(() => new Date().toISOString()),
  toLocalISOString: vi.fn((date: Date | number) => new Date(date).toISOString()),
}));

import { useSessionStore } from '../src/stores/sessionStore';
import { IDLE_REST_TIMER } from '../src/domain/sessionTimer';
import type { TrainingSession } from '../src/types';

function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: 's1',
    startedAt: MOCK_NOW_ISO,
    exercises: [],
    notes: '',
    timerStatus: 'running',
    elapsedSeconds: 0,
    runningSince: MOCK_NOW_ISO,
    lastCheckpointAt: MOCK_NOW_ISO,
    ...overrides,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  dbMocks.getAllSessions.mockResolvedValue([]);
  dbMocks.getPendingTraining.mockResolvedValue(null);
  dbMocks.savePendingTraining.mockResolvedValue(undefined);
  dbMocks.deletePendingTraining.mockResolvedValue(undefined);
  dbMocks.addSession.mockResolvedValue(undefined);

  // 重置 store 状态
  useSessionStore.setState({
    sessions: [],
    activeSession: null,
    staleSession: null,
    restTimer: IDLE_REST_TIMER,
    isLoading: false,
    initialized: false,
  });

  // 使用 vi.useFakeTimers 锁定时间
  vi.useFakeTimers();
  vi.setSystemTime(MOCK_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('startSession', () => {
  it('创建新会话：timerStatus=running，runningSince=now', () => {
    const store = useSessionStore.getState();
    const session = store.startSession();

    expect(session.timerStatus).toBe('running');
    expect(session.elapsedSeconds).toBe(0);
    expect(session.runningSince).toBe(MOCK_NOW_ISO);
    expect(session.lastCheckpointAt).toBe(MOCK_NOW_ISO);
    // zustand getState() 返回快照，set 之后需重新获取
    expect(useSessionStore.getState().activeSession?.id).toBe(session.id);
    expect(useSessionStore.getState().staleSession).toBeNull();
  });

  it('开始时立即持久化 pending', async () => {
    const store = useSessionStore.getState();
    store.startSession();
    // _persistPending 是异步串行写入，需等待
    await vi.waitFor(() => {
      expect(dbMocks.savePendingTraining).toHaveBeenCalledTimes(1);
    });
  });
});

describe('resumeSession', () => {
  it('无 pending：返回 false', async () => {
    dbMocks.getPendingTraining.mockResolvedValue(null);
    const result = await useSessionStore.getState().resumeSession();
    expect(result).toBe(false);
    expect(useSessionStore.getState().activeSession).toBeNull();
  });

  it('pending 为 paused：恢复为 paused 状态', async () => {
    const pending = makeSession({
      timerStatus: 'paused',
      elapsedSeconds: 100,
      runningSince: null,
    });
    dbMocks.getPendingTraining.mockResolvedValue(pending);

    const result = await useSessionStore.getState().resumeSession();

    expect(result).toBe(true);
    const active = useSessionStore.getState().activeSession;
    expect(active?.timerStatus).toBe('paused');
    expect(active?.elapsedSeconds).toBe(100);
    expect(useSessionStore.getState().staleSession).toBeNull();
  });

  it('pending 为 running 且未超时：正常恢复运行', async () => {
    const pending = makeSession({
      timerStatus: 'running',
      elapsedSeconds: 50,
      runningSince: new Date(MOCK_NOW - 60 * 1000).toISOString(),
      lastCheckpointAt: new Date(MOCK_NOW - 60 * 1000).toISOString(),
    });
    dbMocks.getPendingTraining.mockResolvedValue(pending);

    const result = await useSessionStore.getState().resumeSession();

    expect(result).toBe(true);
    const active = useSessionStore.getState().activeSession;
    expect(active?.timerStatus).toBe('running');
    // runningSince 不变，按时间戳计算
    expect(active?.runningSince).toBe(pending.runningSince);
  });

  it('pending 为 running 但超过 4 小时：设置为 staleSession，不自动恢复', async () => {
    const pending = makeSession({
      timerStatus: 'running',
      elapsedSeconds: 100,
      runningSince: new Date(MOCK_NOW - 5 * 3600 * 1000).toISOString(),
      lastCheckpointAt: new Date(MOCK_NOW - 5 * 3600 * 1000).toISOString(),
    });
    dbMocks.getPendingTraining.mockResolvedValue(pending);

    const result = await useSessionStore.getState().resumeSession();

    expect(result).toBe(false);
    expect(useSessionStore.getState().activeSession).toBeNull();
    expect(useSessionStore.getState().staleSession?.id).toBe(pending.id);
  });

  it('pending 跨自然日：设置为 staleSession', async () => {
    const yesterday = new Date(MOCK_NOW);
    yesterday.setDate(yesterday.getDate() - 1);
    const pending = makeSession({
      timerStatus: 'running',
      elapsedSeconds: 30,
      runningSince: yesterday.toISOString(),
      lastCheckpointAt: yesterday.toISOString(),
    });
    dbMocks.getPendingTraining.mockResolvedValue(pending);

    const result = await useSessionStore.getState().resumeSession();

    expect(result).toBe(false);
    expect(useSessionStore.getState().staleSession).not.toBeNull();
  });

  it('无 timerStatus 的会话不再被迁移恢复', async () => {
    // 删除 legacy 兼容后，无 timerStatus 的数据不再被恢复
    const startedAt = new Date(MOCK_NOW - 1800 * 1000).toISOString();
    const updatedAt = new Date(MOCK_NOW - 60 * 1000).toISOString();
    const noTimerStatus = {
      id: 'no-timer',
      startedAt,
      updatedAt,
      exercises: [],
    };
    dbMocks.getPendingTraining.mockResolvedValue(noTimerStatus);

    const result = await useSessionStore.getState().resumeSession();

    expect(result).toBe(false);
    expect(useSessionStore.getState().activeSession).toBeNull();
  });
});

describe('pauseSession / continueSession', () => {
  it('pauseSession：running -> paused，清空休息计时', () => {
    const store = useSessionStore.getState();
    const session = store.startSession();
    expect(session.timerStatus).toBe('running');

    // 设置休息计时器在运行
    useSessionStore.getState().startRestTimer(60, 'ex1');
    expect(useSessionStore.getState().restTimer.status).toBe('running');

    useSessionStore.getState().pauseSession();

    const active = useSessionStore.getState().activeSession;
    expect(active?.timerStatus).toBe('paused');
    expect(active?.runningSince).toBeNull();
    // 暂停训练时清空当前休息计时
    expect(useSessionStore.getState().restTimer.status).toBe('idle');
    expect(useSessionStore.getState().restTimer).toEqual(IDLE_REST_TIMER);
  });

  it('pauseSession 对已 paused 的会话无效', () => {
    const store = useSessionStore.getState();
    store.startSession();
    store.pauseSession();
    expect(useSessionStore.getState().activeSession?.timerStatus).toBe('paused');
    const pausedElapsed = useSessionStore.getState().activeSession?.elapsedSeconds;

    // 推进时间后再次暂停，状态不应改变
    vi.setSystemTime(MOCK_NOW + 60 * 1000);
    useSessionStore.getState().pauseSession();
    expect(useSessionStore.getState().activeSession?.timerStatus).toBe('paused');
    expect(useSessionStore.getState().activeSession?.elapsedSeconds).toBe(pausedElapsed);
  });

  it('continueSession：paused -> running，runningSince=now', () => {
    const store = useSessionStore.getState();
    store.startSession();
    store.pauseSession();
    expect(useSessionStore.getState().activeSession?.timerStatus).toBe('paused');

    // 推进时间 30 秒
    vi.setSystemTime(MOCK_NOW + 30 * 1000);
    store.continueSession();

    const active = useSessionStore.getState().activeSession;
    expect(active?.timerStatus).toBe('running');
    expect(active?.runningSince).toBe(new Date(MOCK_NOW + 30 * 1000).toISOString());
  });

  it('continueSession 对 running 的会话无效', () => {
    const store = useSessionStore.getState();
    store.startSession();
    const originalRunningSince = useSessionStore.getState().activeSession?.runningSince;

    store.continueSession();

    expect(useSessionStore.getState().activeSession?.runningSince).toBe(originalRunningSince);
  });
});

describe('checkpointSession', () => {
  it('running：累加区间，重置 runningSince', () => {
    const store = useSessionStore.getState();
    store.startSession();
    // 推进 45 秒
    vi.setSystemTime(MOCK_NOW + 45 * 1000);

    store.checkpointSession();

    const active = useSessionStore.getState().activeSession;
    expect(active?.elapsedSeconds).toBe(45);
    expect(active?.runningSince).toBe(new Date(MOCK_NOW + 45 * 1000).toISOString());
    expect(active?.timerStatus).toBe('running');
  });

  it('paused：不执行 checkpoint', () => {
    const store = useSessionStore.getState();
    store.startSession();
    store.pauseSession();
    const before = useSessionStore.getState().activeSession?.elapsedSeconds;

    vi.setSystemTime(MOCK_NOW + 60 * 1000);
    store.checkpointSession();

    expect(useSessionStore.getState().activeSession?.elapsedSeconds).toBe(before);
  });
});

describe('resolveStaleSession', () => {
  beforeEach(async () => {
    // 准备一个 stale 会话
    const pending = makeSession({
      timerStatus: 'running',
      elapsedSeconds: 200,
      runningSince: new Date(MOCK_NOW - 5 * 3600 * 1000).toISOString(),
      lastCheckpointAt: new Date(MOCK_NOW - 5 * 3600 * 1000).toISOString(),
    });
    dbMocks.getPendingTraining.mockResolvedValue(pending);
    await useSessionStore.getState().resumeSession();
    expect(useSessionStore.getState().staleSession).not.toBeNull();
  });

  it('continue：排除空白，从当前时间继续运行', async () => {
    await useSessionStore.getState().resolveStaleSession('continue');

    const active = useSessionStore.getState().activeSession;
    expect(active).not.toBeNull();
    expect(active?.timerStatus).toBe('running');
    // elapsedSeconds 保持原值（不累加空白）
    expect(active?.elapsedSeconds).toBe(200);
    // runningSince 设为当前时间
    expect(active?.runningSince).toBe(MOCK_NOW_ISO);
    expect(useSessionStore.getState().staleSession).toBeNull();
    // 持久化
    expect(dbMocks.savePendingTraining).toHaveBeenCalled();
  });

  it('end：以最后 checkpoint 结束，写入历史并删除 pending', async () => {
    const lastCheckpoint = new Date(MOCK_NOW - 5 * 3600 * 1000).toISOString();
    await useSessionStore.getState().resolveStaleSession('end');

    expect(dbMocks.addSession).toHaveBeenCalledTimes(1);
    const saved = dbMocks.addSession.mock.calls[0][0] as TrainingSession;
    expect(saved.timerStatus).toBe('completed');
    expect(saved.endedAt).toBe(lastCheckpoint);
    expect(dbMocks.deletePendingTraining).toHaveBeenCalled();
    expect(useSessionStore.getState().staleSession).toBeNull();
    expect(useSessionStore.getState().activeSession).toBeNull();
  });

  it('discard：仅删除 pending，不写入历史', async () => {
    await useSessionStore.getState().resolveStaleSession('discard');

    expect(dbMocks.addSession).not.toHaveBeenCalled();
    expect(dbMocks.deletePendingTraining).toHaveBeenCalled();
    expect(useSessionStore.getState().staleSession).toBeNull();
    expect(useSessionStore.getState().activeSession).toBeNull();
  });
});

describe('endSession', () => {
  it('running：累加当前区间并写入历史', async () => {
    const store = useSessionStore.getState();
    store.startSession();
    vi.setSystemTime(MOCK_NOW + 90 * 1000);

    await store.endSession('notes-here');

    expect(dbMocks.addSession).toHaveBeenCalledTimes(1);
    const saved = dbMocks.addSession.mock.calls[0][0] as TrainingSession;
    expect(saved.timerStatus).toBe('completed');
    expect(saved.elapsedSeconds).toBe(90);
    expect(saved.endedAt).toBe(new Date(MOCK_NOW + 90 * 1000).toISOString());
    expect(saved.notes).toBe('notes-here');
    expect(dbMocks.deletePendingTraining).toHaveBeenCalled();
    expect(useSessionStore.getState().activeSession).toBeNull();
  });

  it('paused：直接结束，不累加', async () => {
    const store = useSessionStore.getState();
    store.startSession();
    store.pauseSession();
    const pausedElapsed = useSessionStore.getState().activeSession?.elapsedSeconds ?? 0;

    vi.setSystemTime(MOCK_NOW + 60 * 1000);
    await store.endSession();

    const saved = dbMocks.addSession.mock.calls[0][0] as TrainingSession;
    expect(saved.elapsedSeconds).toBe(pausedElapsed);
  });
});

describe('_persistPending 串行写入', () => {
  it('多次连续调用不会丢失，按顺序串行执行', async () => {
    const store = useSessionStore.getState();
    store.startSession();

    // 触发多次连续持久化
    store.pauseSession();
    store.continueSession();

    // 等待所有 pending promise 完成
    await vi.waitFor(() => {
      expect(dbMocks.savePendingTraining.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    // 最后一次保存的状态应该是 running
    const lastCall = dbMocks.savePendingTraining.mock.calls.at(-1)?.[0] as TrainingSession;
    expect(lastCall.timerStatus).toBe('running');
  });
});

describe('resetRuntimeState', () => {
  it('备份替换数据后清理活动会话和休息计时', () => {
    const store = useSessionStore.getState();
    store.startSession();
    store.startRestTimer(60, 'exercise-1');

    useSessionStore.getState().resetRuntimeState();

    const state = useSessionStore.getState();
    expect(state.activeSession).toBeNull();
    expect(state.staleSession).toBeNull();
    expect(state.restTimer).toEqual(IDLE_REST_TIMER);
  });
});

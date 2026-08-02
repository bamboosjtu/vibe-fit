import { describe, it, expect } from 'vitest';
import {
  computeElapsedSeconds,
  formatTimer,
  isStaleSession,
  migrateLegacySession,
  checkpointTimer,
  pauseTimer,
  continueTimer,
  endTimer,
  continueAfterGap,
  endAtLastCheckpoint,
  getTimerStatusText,
  MAX_RESUME_GAP_MS,
} from '../src/domain/sessionTimer';
import type { TrainingSession } from '../src/types';

const NOW = new Date('2026-08-02T12:00:00.000Z').getTime();
const NOW_ISO = new Date(NOW).toISOString();

function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: 's1',
    startedAt: NOW_ISO,
    exercises: [],
    notes: '',
    timerStatus: 'running',
    elapsedSeconds: 0,
    runningSince: NOW_ISO,
    lastCheckpointAt: NOW_ISO,
    ...overrides,
  };
}

describe('computeElapsedSeconds', () => {
  it('running 状态：累加 (now - runningSince) 秒数', () => {
    const session = makeSession({
      elapsedSeconds: 100,
      runningSince: new Date(NOW - 30 * 1000).toISOString(),
    });
    expect(computeElapsedSeconds(session, NOW)).toBe(130);
  });

  it('paused 状态：仅返回 elapsedSeconds', () => {
    const session = makeSession({
      timerStatus: 'paused',
      elapsedSeconds: 100,
      runningSince: null,
    });
    expect(computeElapsedSeconds(session, NOW)).toBe(100);
  });

  it('completed 状态：仅返回 elapsedSeconds', () => {
    const session = makeSession({
      timerStatus: 'completed',
      elapsedSeconds: 200,
      runningSince: null,
    });
    expect(computeElapsedSeconds(session, NOW)).toBe(200);
  });

  it('running 但 runningSince 缺失：仅返回 elapsedSeconds', () => {
    const session = makeSession({
      timerStatus: 'running',
      elapsedSeconds: 50,
      runningSince: null,
    });
    expect(computeElapsedSeconds(session, NOW)).toBe(50);
  });

  it('时钟回退（now 早于 runningSince）：仅返回 base，不出现负数', () => {
    const session = makeSession({
      elapsedSeconds: 30,
      runningSince: new Date(NOW + 60 * 1000).toISOString(),
    });
    expect(computeElapsedSeconds(session, NOW)).toBe(30);
  });

  it('elapsedSeconds 缺失时按 0 处理', () => {
    const session = makeSession({
      elapsedSeconds: undefined,
      runningSince: new Date(NOW - 10 * 1000).toISOString(),
    });
    expect(computeElapsedSeconds(session, NOW)).toBe(10);
  });
});

describe('formatTimer', () => {
  it('0 秒格式化为 00:00:00', () => {
    expect(formatTimer(0)).toBe('00:00:00');
  });

  it('3661 秒格式化为 01:01:01', () => {
    expect(formatTimer(3661)).toBe('01:01:01');
  });

  it('86399 秒格式化为 23:59:59', () => {
    expect(formatTimer(86399)).toBe('23:59:59');
  });

  it('超过 24 小时仍正常展示', () => {
    expect(formatTimer(90061)).toBe('25:01:01');
  });
});

describe('isStaleSession', () => {
  it('非 running 状态：永远不是 stale', () => {
    const session = makeSession({
      timerStatus: 'paused',
      lastCheckpointAt: new Date(NOW - 10 * 3600 * 1000).toISOString(),
    });
    expect(isStaleSession(session, NOW)).toBe(false);
  });

  it('running 且 checkpoint 在 4 小时内：不是 stale', () => {
    const session = makeSession({
      timerStatus: 'running',
      lastCheckpointAt: new Date(NOW - 3 * 3600 * 1000).toISOString(),
    });
    expect(isStaleSession(session, NOW)).toBe(false);
  });

  it('running 且 checkpoint 超过 4 小时：是 stale', () => {
    const session = makeSession({
      timerStatus: 'running',
      lastCheckpointAt: new Date(NOW - MAX_RESUME_GAP_MS - 1000).toISOString(),
    });
    expect(isStaleSession(session, NOW)).toBe(true);
  });

  it('running 且跨自然日：是 stale', () => {
    const yesterday = new Date(NOW);
    yesterday.setDate(yesterday.getDate() - 1);
    const session = makeSession({
      timerStatus: 'running',
      lastCheckpointAt: yesterday.toISOString(),
    });
    expect(isStaleSession(session, NOW)).toBe(true);
  });

  it('running 但缺少 checkpoint：不是 stale（无法判定）', () => {
    const session = makeSession({
      timerStatus: 'running',
      lastCheckpointAt: undefined,
      runningSince: null,
      updatedAt: undefined,
    });
    expect(isStaleSession(session, NOW)).toBe(false);
  });

  it('回退到 runningSince 判定（lastCheckpointAt 缺失）', () => {
    const session = makeSession({
      timerStatus: 'running',
      lastCheckpointAt: undefined,
      runningSince: new Date(NOW - 5 * 3600 * 1000).toISOString(),
    });
    expect(isStaleSession(session, NOW)).toBe(true);
  });
});

describe('migrateLegacySession', () => {
  it('已有 timerStatus 的会话：原样返回', () => {
    const session = makeSession({ timerStatus: 'paused', elapsedSeconds: 42 });
    const result = migrateLegacySession(session);
    expect(result.timerStatus).toBe('paused');
    expect(result.elapsedSeconds).toBe(42);
  });

  it('旧数据（无 timerStatus）：默认恢复为 paused', () => {
    const startedAt = new Date(NOW - 1800 * 1000).toISOString();
    const updatedAt = new Date(NOW - 60 * 1000).toISOString();
    const legacy = {
      id: 'legacy1',
      startedAt,
      updatedAt,
      exercises: [],
    } as Partial<TrainingSession> & { startedAt: string; updatedAt?: string };

    const result = migrateLegacySession(legacy);
    expect(result.timerStatus).toBe('paused');
    expect(result.runningSince).toBeNull();
    expect(result.elapsedSeconds).toBe(1740); // updatedAt - startedAt
    expect(result.lastCheckpointAt).toBe(updatedAt);
  });

  it('旧数据使用 updatedAt - startedAt 估算，不使用当前时间', () => {
    const startedAt = new Date(NOW - 7200 * 1000).toISOString(); // 2 小时前
    const updatedAt = new Date(NOW - 3600 * 1000).toISOString(); // 1 小时前
    const legacy = {
      id: 'legacy2',
      startedAt,
      updatedAt,
      exercises: [],
    } as Partial<TrainingSession> & { startedAt: string; updatedAt?: string };

    const result = migrateLegacySession(legacy);
    // 应该是 3600（updatedAt-startedAt），而不是 7200（now-startedAt）
    expect(result.elapsedSeconds).toBe(3600);
  });

  it('旧数据缺失 updatedAt：使用 startedAt 作为估算基准', () => {
    const startedAt = new Date(NOW - 1000 * 1000).toISOString();
    const legacy = {
      id: 'legacy3',
      startedAt,
      exercises: [],
    } as Partial<TrainingSession> & { startedAt: string; updatedAt?: string };

    const result = migrateLegacySession(legacy);
    expect(result.elapsedSeconds).toBe(0);
    expect(result.lastCheckpointAt).toBe(startedAt);
  });
});

describe('checkpointTimer', () => {
  it('running：累加当前区间，重置 runningSince 和 lastCheckpointAt', () => {
    const session = makeSession({
      elapsedSeconds: 100,
      runningSince: new Date(NOW - 45 * 1000).toISOString(),
    });
    const result = checkpointTimer(session, NOW);
    expect(result.timerStatus).toBe('running');
    expect(result.elapsedSeconds).toBe(145);
    expect(result.runningSince).toBe(NOW_ISO);
    expect(result.lastCheckpointAt).toBe(NOW_ISO);
  });

  it('paused：不修改 elapsedSeconds，仅更新 lastCheckpointAt', () => {
    const session = makeSession({
      timerStatus: 'paused',
      elapsedSeconds: 100,
      runningSince: null,
    });
    const result = checkpointTimer(session, NOW);
    expect(result.timerStatus).toBe('paused');
    expect(result.elapsedSeconds).toBe(100);
    expect(result.runningSince).toBeNull();
    expect(result.lastCheckpointAt).toBe(NOW_ISO);
  });
});

describe('pauseTimer', () => {
  it('running：累加当前区间到 elapsedSeconds，设 runningSince=null', () => {
    const session = makeSession({
      elapsedSeconds: 100,
      runningSince: new Date(NOW - 30 * 1000).toISOString(),
    });
    const result = pauseTimer(session, NOW);
    expect(result.timerStatus).toBe('paused');
    expect(result.elapsedSeconds).toBe(130);
    expect(result.runningSince).toBeNull();
    expect(result.lastCheckpointAt).toBe(NOW_ISO);
  });

  it('已 paused：保持原 elapsedSeconds 不变', () => {
    const session = makeSession({
      timerStatus: 'paused',
      elapsedSeconds: 100,
      runningSince: null,
    });
    const result = pauseTimer(session, NOW);
    expect(result.timerStatus).toBe('paused');
    expect(result.elapsedSeconds).toBe(100);
    expect(result.runningSince).toBeNull();
  });
});

describe('continueTimer', () => {
  it('设置 running 状态，runningSince=now', () => {
    const result = continueTimer(NOW);
    expect(result.timerStatus).toBe('running');
    expect(result.runningSince).toBe(NOW_ISO);
    expect(result.lastCheckpointAt).toBe(NOW_ISO);
    // elapsedSeconds 由调用者合并，这里固定为 0
    expect(result.elapsedSeconds).toBe(0);
  });
});

describe('endTimer', () => {
  it('running：累加当前区间，设为 completed', () => {
    const session = makeSession({
      elapsedSeconds: 100,
      runningSince: new Date(NOW - 50 * 1000).toISOString(),
    });
    const result = endTimer(session, NOW);
    expect(result.timerStatus).toBe('completed');
    expect(result.elapsedSeconds).toBe(150);
    expect(result.runningSince).toBeNull();
    expect(result.endedAt).toBe(NOW_ISO);
  });

  it('paused：直接结束，不累加', () => {
    const session = makeSession({
      timerStatus: 'paused',
      elapsedSeconds: 200,
      runningSince: null,
    });
    const result = endTimer(session, NOW);
    expect(result.timerStatus).toBe('completed');
    expect(result.elapsedSeconds).toBe(200);
    expect(result.endedAt).toBe(NOW_ISO);
  });
});

describe('continueAfterGap', () => {
  it('排除长时间空白：不把空白时间累加到 elapsedSeconds', () => {
    // 最后 checkpoint 是 5 小时前，已运行 100 秒
    const session = makeSession({
      timerStatus: 'running',
      elapsedSeconds: 100,
      runningSince: new Date(NOW - 5 * 3600 * 1000).toISOString(),
      lastCheckpointAt: new Date(NOW - 5 * 3600 * 1000).toISOString(),
    });
    const result = continueAfterGap(session, NOW);
    // 不应把 5 小时累加进去
    expect(result.elapsedSeconds).toBe(100);
    expect(result.timerStatus).toBe('running');
    expect(result.runningSince).toBe(NOW_ISO);
    expect(result.lastCheckpointAt).toBe(NOW_ISO);
  });

  it('即使没运行过，也能从当前时间开始', () => {
    const session = makeSession({
      timerStatus: 'paused',
      elapsedSeconds: 50,
      runningSince: null,
      lastCheckpointAt: new Date(NOW - 10 * 3600 * 1000).toISOString(),
    });
    const result = continueAfterGap(session, NOW);
    expect(result.elapsedSeconds).toBe(50);
    expect(result.timerStatus).toBe('running');
    expect(result.runningSince).toBe(NOW_ISO);
  });
});

describe('endAtLastCheckpoint', () => {
  it('结束于最后 checkpoint 时间，不累加之后的运行时间', () => {
    const checkpoint = new Date(NOW - 2 * 3600 * 1000).toISOString();
    const session = makeSession({
      timerStatus: 'running',
      elapsedSeconds: 300,
      runningSince: new Date(NOW - 3 * 3600 * 1000).toISOString(),
      lastCheckpointAt: checkpoint,
    });
    const result = endAtLastCheckpoint(session);
    expect(result.timerStatus).toBe('completed');
    expect(result.elapsedSeconds).toBe(300);
    expect(result.runningSince).toBeNull();
    expect(result.endedAt).toBe(checkpoint);
    expect(result.lastCheckpointAt).toBe(checkpoint);
  });

  it('lastCheckpointAt 缺失时回退到 runningSince', () => {
    const runningSince = new Date(NOW - 3600 * 1000).toISOString();
    const session = makeSession({
      timerStatus: 'running',
      elapsedSeconds: 100,
      runningSince,
      lastCheckpointAt: undefined,
    });
    const result = endAtLastCheckpoint(session);
    expect(result.endedAt).toBe(runningSince);
  });
});

describe('getTimerStatusText', () => {
  it('running -> 训练中', () => {
    expect(getTimerStatusText('running')).toBe('训练中');
  });

  it('paused -> 已暂停', () => {
    expect(getTimerStatusText('paused')).toBe('已暂停');
  });

  it('completed -> 已完成', () => {
    expect(getTimerStatusText('completed')).toBe('已完成');
  });

  it('undefined -> 准备开始', () => {
    expect(getTimerStatusText(undefined)).toBe('准备开始');
  });
});

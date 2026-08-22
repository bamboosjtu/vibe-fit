import { describe, it, expect, vi } from 'vitest';

// 让 toLocalISOString 在测试中退化为 UTC ISO，保持测试期望与原有 .toISOString() 一致
vi.mock('../src/utils/helpers', () => ({
  toLocalISOString: (date: Date | number) => new Date(date).toISOString(),
  getCurrentISOString: () => new Date().toISOString(),
}));

import {
  computeElapsedSeconds,
  formatTimer,
  isStaleSession,
  checkpointTimer,
  pauseTimer,
  continueTimer,
  endTimer,
  continueAfterGap,
  endAtLastCheckpoint,
  getTimerStatusText,
  MAX_RESUME_GAP_MS,
  IDLE_REST_TIMER,
  computeRestRemaining,
  isRestTimerExpired,
  formatRestTime,
  startRestTimerState,
  pauseRestTimerState,
  resumeRestTimerState,
  computeCardioElapsedSeconds,
  startCardioRecord,
  pauseCardioRecord,
  resumeCardioRecord,
  completeCardioRecord,
} from '../src/domain/sessionTimer';
import type { RestTimerState, CardioRecord } from '../src/types';
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

// ============================================================================
// 休息计时器纯函数测试
// ============================================================================

describe('computeRestRemaining', () => {
  it('running：计算 endsAt - now 的秒数', () => {
    const timer: RestTimerState = {
      status: 'running',
      sessionExerciseId: 'ex1',
      durationSeconds: 75,
      remainingSeconds: 75,
      endsAt: new Date(NOW + 30 * 1000).toISOString(),
    };
    expect(computeRestRemaining(timer, NOW)).toBe(30);
  });

  it('running 且已过期：返回 0', () => {
    const timer: RestTimerState = {
      status: 'running',
      sessionExerciseId: 'ex1',
      durationSeconds: 75,
      remainingSeconds: 75,
      endsAt: new Date(NOW - 10 * 1000).toISOString(),
    };
    expect(computeRestRemaining(timer, NOW)).toBe(0);
  });

  it('paused：返回 remainingSeconds', () => {
    const timer: RestTimerState = {
      status: 'paused',
      sessionExerciseId: 'ex1',
      durationSeconds: 75,
      remainingSeconds: 45,
      endsAt: null,
    };
    expect(computeRestRemaining(timer, NOW)).toBe(45);
  });

  it('idle：返回 0', () => {
    expect(computeRestRemaining(IDLE_REST_TIMER, NOW)).toBe(0);
  });
});

describe('isRestTimerExpired', () => {
  it('running 且剩余 > 0：false', () => {
    const timer: RestTimerState = {
      status: 'running',
      sessionExerciseId: 'ex1',
      durationSeconds: 75,
      remainingSeconds: 75,
      endsAt: new Date(NOW + 30 * 1000).toISOString(),
    };
    expect(isRestTimerExpired(timer, NOW)).toBe(false);
  });

  it('running 且已归零：true', () => {
    const timer: RestTimerState = {
      status: 'running',
      sessionExerciseId: 'ex1',
      durationSeconds: 75,
      remainingSeconds: 75,
      endsAt: new Date(NOW - 1 * 1000).toISOString(),
    };
    expect(isRestTimerExpired(timer, NOW)).toBe(true);
  });

  it('paused：false（暂停不算过期）', () => {
    const timer: RestTimerState = {
      status: 'paused',
      sessionExerciseId: 'ex1',
      durationSeconds: 75,
      remainingSeconds: 0,
      endsAt: null,
    };
    expect(isRestTimerExpired(timer, NOW)).toBe(false);
  });
});

describe('formatRestTime', () => {
  it('75 秒格式化为 01:15', () => {
    expect(formatRestTime(75)).toBe('01:15');
  });

  it('0 秒格式化为 00:00', () => {
    expect(formatRestTime(0)).toBe('00:00');
  });

  it('5 秒格式化为 00:05', () => {
    expect(formatRestTime(5)).toBe('00:05');
  });
});

describe('startRestTimerState', () => {
  it('创建 running 状态，endsAt = now + duration', () => {
    const timer = startRestTimerState(75, 'ex1', NOW);
    expect(timer.status).toBe('running');
    expect(timer.sessionExerciseId).toBe('ex1');
    expect(timer.durationSeconds).toBe(75);
    expect(timer.remainingSeconds).toBe(75);
    expect(timer.endsAt).toBe(new Date(NOW + 75 * 1000).toISOString());
  });
});

describe('pauseRestTimerState', () => {
  it('running -> paused：结算剩余秒数，清除 endsAt', () => {
    const running: RestTimerState = {
      status: 'running',
      sessionExerciseId: 'ex1',
      durationSeconds: 75,
      remainingSeconds: 75,
      endsAt: new Date(NOW + 30 * 1000).toISOString(),
    };
    const paused = pauseRestTimerState(running, NOW);
    expect(paused.status).toBe('paused');
    expect(paused.remainingSeconds).toBe(30);
    expect(paused.endsAt).toBeNull();
  });

  it('已 paused：不变', () => {
    const paused: RestTimerState = {
      status: 'paused',
      sessionExerciseId: 'ex1',
      durationSeconds: 75,
      remainingSeconds: 45,
      endsAt: null,
    };
    const result = pauseRestTimerState(paused, NOW);
    expect(result).toBe(paused);
  });
});

describe('resumeRestTimerState', () => {
  it('paused -> running：以 remainingSeconds 重新计算 endsAt', () => {
    const paused: RestTimerState = {
      status: 'paused',
      sessionExerciseId: 'ex1',
      durationSeconds: 75,
      remainingSeconds: 45,
      endsAt: null,
    };
    const running = resumeRestTimerState(paused, NOW);
    expect(running.status).toBe('running');
    expect(running.endsAt).toBe(new Date(NOW + 45 * 1000).toISOString());
  });

  it('已 running：不变', () => {
    const running: RestTimerState = {
      status: 'running',
      sessionExerciseId: 'ex1',
      durationSeconds: 75,
      remainingSeconds: 75,
      endsAt: new Date(NOW + 30 * 1000).toISOString(),
    };
    const result = resumeRestTimerState(running, NOW);
    expect(result).toBe(running);
  });
});

// ============================================================================
// 有氧训练计时纯函数测试
// ============================================================================

describe('computeCardioElapsedSeconds', () => {
  it('running：累加 (now - runningSince) 秒数', () => {
    const record: CardioRecord = {
      status: 'running',
      elapsedSeconds: 100,
      runningSince: new Date(NOW - 30 * 1000).toISOString(),
    };
    expect(computeCardioElapsedSeconds(record, NOW)).toBe(130);
  });

  it('paused：仅返回 elapsedSeconds', () => {
    const record: CardioRecord = {
      status: 'paused',
      elapsedSeconds: 100,
      runningSince: null,
    };
    expect(computeCardioElapsedSeconds(record, NOW)).toBe(100);
  });

  it('completed：仅返回 elapsedSeconds', () => {
    const record: CardioRecord = {
      status: 'completed',
      elapsedSeconds: 200,
      runningSince: null,
    };
    expect(computeCardioElapsedSeconds(record, NOW)).toBe(200);
  });

  it('undefined：返回 0', () => {
    expect(computeCardioElapsedSeconds(undefined, NOW)).toBe(0);
  });

  it('时钟回退：不出现负数', () => {
    const record: CardioRecord = {
      status: 'running',
      elapsedSeconds: 50,
      runningSince: new Date(NOW + 60 * 1000).toISOString(),
    };
    expect(computeCardioElapsedSeconds(record, NOW)).toBe(50);
  });
});

describe('startCardioRecord', () => {
  it('创建 running 状态，runningSince=now', () => {
    const record = startCardioRecord(1800, NOW);
    expect(record.status).toBe('running');
    expect(record.startedAt).toBe(NOW_ISO);
    expect(record.elapsedSeconds).toBe(0);
    expect(record.runningSince).toBe(NOW_ISO);
    expect(record.targetDurationSeconds).toBe(1800);
  });

  it('无目标时长时 targetDurationSeconds 为 undefined', () => {
    const record = startCardioRecord(undefined, NOW);
    expect(record.targetDurationSeconds).toBeUndefined();
  });
});

describe('pauseCardioRecord', () => {
  it('running -> paused：结算当前区间', () => {
    const record: CardioRecord = {
      status: 'running',
      elapsedSeconds: 100,
      runningSince: new Date(NOW - 30 * 1000).toISOString(),
    };
    const paused = pauseCardioRecord(record, NOW);
    expect(paused.status).toBe('paused');
    expect(paused.elapsedSeconds).toBe(130);
    expect(paused.runningSince).toBeNull();
  });

  it('已 paused：不变', () => {
    const record: CardioRecord = {
      status: 'paused',
      elapsedSeconds: 100,
      runningSince: null,
    };
    expect(pauseCardioRecord(record, NOW)).toBe(record);
  });
});

describe('resumeCardioRecord', () => {
  it('paused -> running：保留 elapsedSeconds，设新 runningSince', () => {
    const record: CardioRecord = {
      status: 'paused',
      elapsedSeconds: 100,
      runningSince: null,
    };
    const running = resumeCardioRecord(record, NOW);
    expect(running.status).toBe('running');
    expect(running.elapsedSeconds).toBe(100);
    expect(running.runningSince).toBe(NOW_ISO);
  });

  it('已 running：不变', () => {
    const record: CardioRecord = {
      status: 'running',
      elapsedSeconds: 100,
      runningSince: NOW_ISO,
    };
    expect(resumeCardioRecord(record, NOW)).toBe(record);
  });
});

describe('completeCardioRecord', () => {
  it('running：结算最后区间，设 completed 和 endedAt', () => {
    const record: CardioRecord = {
      status: 'running',
      elapsedSeconds: 100,
      runningSince: new Date(NOW - 50 * 1000).toISOString(),
    };
    const completed = completeCardioRecord(record, { speed: 8.5, incline: 2 }, NOW);
    expect(completed.status).toBe('completed');
    expect(completed.elapsedSeconds).toBe(150);
    expect(completed.endedAt).toBe(NOW_ISO);
    expect(completed.speed).toBe(8.5);
    expect(completed.incline).toBe(2);
  });

  it('paused：直接完成，不累加', () => {
    const record: CardioRecord = {
      status: 'paused',
      elapsedSeconds: 200,
      runningSince: null,
    };
    const completed = completeCardioRecord(record, { distance: 5 }, NOW);
    expect(completed.status).toBe('completed');
    expect(completed.elapsedSeconds).toBe(200);
    expect(completed.distance).toBe(5);
  });

  it('无 metrics 时只完成计时', () => {
    const record: CardioRecord = {
      status: 'running',
      elapsedSeconds: 0,
      runningSince: NOW_ISO,
    };
    const completed = completeCardioRecord(record, {}, NOW);
    expect(completed.speed).toBeUndefined();
    expect(completed.incline).toBeUndefined();
  });
});

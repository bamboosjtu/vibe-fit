/**
 * 训练计时器纯函数模块
 *
 * 核心原则：
 * - 计时真实数据由时间戳和累计时长计算，不依赖 setInterval 累加
 * - setInterval 只触发 UI 重绘，不作为计时数据源
 * - 页面后台、锁屏和短时关闭不自动暂停
 * - 用户明确暂停后时间停止累计
 * - 长时间中断不得自动累计整个间隔
 */

import type { TrainingSession, TimerStatus, RestTimerState, CardioRecord } from '../types';
import { toLocalISOString } from '../utils/helpers';

/** 最大允许的恢复间隔（毫秒），超过则视为异常中断 */
export const MAX_RESUME_GAP_MS = 4 * 60 * 60 * 1000; // 4 小时

/**
 * 计算当前已运行的累计秒数。
 *
 * - running: elapsedSeconds + (now - runningSince)
 * - paused / completed / undefined: elapsedSeconds
 */
export function computeElapsedSeconds(
  session: Pick<TrainingSession, 'timerStatus' | 'elapsedSeconds' | 'runningSince'>,
  now: number = Date.now(),
): number {
  const base = session.elapsedSeconds ?? 0;
  if (session.timerStatus === 'running' && session.runningSince) {
    const runningMs = now - new Date(session.runningSince).getTime();
    return base + Math.max(0, Math.floor(runningMs / 1000));
  }
  return base;
}

/**
 * 格式化秒数为 HH:MM:SS 字符串。
 */
export function formatTimer(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return [hours, minutes, secs]
    .map((v) => v.toString().padStart(2, '0'))
    .join(':');
}

/**
 * 检查运行中的会话是否为异常中断（超过 4 小时或跨自然日）。
 *
 * 仅对 timerStatus === 'running' 的会话有意义。
 * updatedAt 为可选字段，来自 PendingTrainingState。
 */
export function isStaleSession(
  session: Pick<TrainingSession, 'timerStatus' | 'lastCheckpointAt' | 'runningSince'> & { updatedAt?: string },
  now: number = Date.now(),
): boolean {
  if (session.timerStatus !== 'running') return false;

  const checkpointStr = session.lastCheckpointAt || session.runningSince || session.updatedAt;
  if (!checkpointStr) return false;

  const checkpointTime = new Date(checkpointStr).getTime();
  const gapMs = now - checkpointTime;

  // 超过 4 小时
  if (gapMs > MAX_RESUME_GAP_MS) return true;

  // 跨自然日
  const checkpointDate = new Date(checkpointTime);
  const nowDate = new Date(now);
  if (checkpointDate.toDateString() !== nowDate.toDateString()) return true;

  return false;
}

/**
 * 迁移旧训练会话数据（无计时器字段的 pending training）。
 *
 * 旧 pending 默认恢复为暂停状态。
 * elapsedSeconds 使用 updatedAt - startedAt 估算，不使用当前时间。
 */
export function migrateLegacySession(
  session: Partial<TrainingSession> & { startedAt: string; updatedAt?: string },
): TrainingSession {
  if (session.timerStatus) {
    return session as TrainingSession;
  }

  // 旧数据无计时器字段，估算 elapsedSeconds
  const startedAt = new Date(session.startedAt).getTime();
  const updatedAt = session.updatedAt
    ? new Date(session.updatedAt).getTime()
    : startedAt;
  const elapsedSeconds = Math.max(0, Math.floor((updatedAt - startedAt) / 1000));

  return {
    ...(session as TrainingSession),
    timerStatus: 'paused',
    elapsedSeconds,
    runningSince: null,
    lastCheckpointAt: session.updatedAt || session.startedAt,
  };
}

/**
 * 执行 checkpoint：如果正在运行，将当前区间时间累加到 elapsedSeconds。
 * 返回更新后的计时器字段。
 */
export function checkpointTimer(
  session: Pick<TrainingSession, 'timerStatus' | 'elapsedSeconds' | 'runningSince'>,
  now: number = Date.now(),
): Pick<TrainingSession, 'timerStatus' | 'elapsedSeconds' | 'runningSince' | 'lastCheckpointAt'> {
  const nowIso = toLocalISOString(now);

  if (session.timerStatus === 'running' && session.runningSince) {
    const additionalMs = now - new Date(session.runningSince).getTime();
    const additionalSeconds = Math.max(0, Math.floor(additionalMs / 1000));
    return {
      timerStatus: 'running',
      elapsedSeconds: (session.elapsedSeconds ?? 0) + additionalSeconds,
      runningSince: nowIso,
      lastCheckpointAt: nowIso,
    };
  }

  return {
    timerStatus: session.timerStatus ?? 'paused',
    elapsedSeconds: session.elapsedSeconds ?? 0,
    runningSince: session.runningSince ?? null,
    lastCheckpointAt: nowIso,
  };
}

/**
 * 暂停计时器：将当前运行区间累加到 elapsedSeconds，设置 runningSince = null。
 */
export function pauseTimer(
  session: Pick<TrainingSession, 'timerStatus' | 'elapsedSeconds' | 'runningSince'>,
  now: number = Date.now(),
): Pick<TrainingSession, 'timerStatus' | 'elapsedSeconds' | 'runningSince' | 'lastCheckpointAt'> {
  const nowIso = toLocalISOString(now);

  if (session.timerStatus === 'running' && session.runningSince) {
    const additionalMs = now - new Date(session.runningSince).getTime();
    const additionalSeconds = Math.max(0, Math.floor(additionalMs / 1000));
    return {
      timerStatus: 'paused',
      elapsedSeconds: (session.elapsedSeconds ?? 0) + additionalSeconds,
      runningSince: null,
      lastCheckpointAt: nowIso,
    };
  }

  return {
    timerStatus: 'paused',
    elapsedSeconds: session.elapsedSeconds ?? 0,
    runningSince: null,
    lastCheckpointAt: nowIso,
  };
}

/**
 * 继续计时器：设置 runningSince = now，timerStatus = 'running'。
 * 不修改 elapsedSeconds（已结算的累计时间不变）。
 */
export function continueTimer(
  now: number = Date.now(),
): Pick<TrainingSession, 'timerStatus' | 'elapsedSeconds' | 'runningSince' | 'lastCheckpointAt'> {
  const nowIso = toLocalISOString(now);
  return {
    timerStatus: 'running',
    elapsedSeconds: 0, // 由调用者合并
    runningSince: nowIso,
    lastCheckpointAt: nowIso,
  };
}

/**
 * 结束计时器：将当前运行区间累加，设置 timerStatus = 'completed'。
 */
export function endTimer(
  session: Pick<TrainingSession, 'timerStatus' | 'elapsedSeconds' | 'runningSince'>,
  now: number = Date.now(),
): Pick<TrainingSession, 'timerStatus' | 'elapsedSeconds' | 'runningSince' | 'lastCheckpointAt'> & {
  endedAt: string;
} {
  const nowIso = toLocalISOString(now);

  if (session.timerStatus === 'running' && session.runningSince) {
    const additionalMs = now - new Date(session.runningSince).getTime();
    const additionalSeconds = Math.max(0, Math.floor(additionalMs / 1000));
    return {
      timerStatus: 'completed',
      elapsedSeconds: (session.elapsedSeconds ?? 0) + additionalSeconds,
      runningSince: null,
      lastCheckpointAt: nowIso,
      endedAt: nowIso,
    };
  }

  return {
    timerStatus: 'completed',
    elapsedSeconds: session.elapsedSeconds ?? 0,
    runningSince: null,
    lastCheckpointAt: nowIso,
    endedAt: nowIso,
  };
}

/**
 * 排除长时间空白后继续训练：
 * 将 lastCheckpoint 之前的运行时间累加到 elapsedSeconds，然后从 now 重新开始。
 * 适用于恢复对话框选择"继续训练"。
 *
 * 注意：上次 checkpoint 之前的运行时间已经累加到 elapsedSeconds 中，
 * 因此这里不重复累加，仅从当前时间开始新的运行区间。
 */
export function continueAfterGap(
  session: Pick<TrainingSession, 'timerStatus' | 'elapsedSeconds' | 'runningSince' | 'lastCheckpointAt'>,
  now: number = Date.now(),
): Pick<TrainingSession, 'timerStatus' | 'elapsedSeconds' | 'runningSince' | 'lastCheckpointAt'> {
  const nowIso = toLocalISOString(now);

  return {
    timerStatus: 'running',
    elapsedSeconds: session.elapsedSeconds ?? 0,
    runningSince: nowIso,
    lastCheckpointAt: nowIso,
  };
}

/**
 * 结束于最后 checkpoint（适用于恢复对话框选择"结束上次训练"）。
 */
export function endAtLastCheckpoint(
  session: Pick<TrainingSession, 'timerStatus' | 'elapsedSeconds' | 'runningSince' | 'lastCheckpointAt'>,
): Pick<TrainingSession, 'timerStatus' | 'elapsedSeconds' | 'runningSince' | 'lastCheckpointAt'> & {
  endedAt: string;
} {
  const endedAt = session.lastCheckpointAt || session.runningSince || toLocalISOString(Date.now());
  return {
    timerStatus: 'completed',
    elapsedSeconds: session.elapsedSeconds ?? 0,
    runningSince: null,
    lastCheckpointAt: endedAt,
    endedAt,
  };
}

/**
 * 获取计时器状态显示文本。
 */
export function getTimerStatusText(status: TimerStatus | undefined): string {
  switch (status) {
    case 'running':
      return '训练中';
    case 'paused':
      return '已暂停';
    case 'completed':
      return '已完成';
    default:
      return '准备开始';
  }
}

// ============================================================================
// 休息计时器纯函数（基于时间戳，setInterval 仅刷新显示）
// ============================================================================

/** 空闲状态的休息计时器 */
export const IDLE_REST_TIMER: RestTimerState = {
  status: 'idle',
  sessionExerciseId: null,
  durationSeconds: 0,
  remainingSeconds: 0,
  endsAt: null,
};

/**
 * 计算休息计时器剩余秒数。
 *
 * - running: max(0, (endsAt - now) / 1000)
 * - paused: remainingSeconds
 * - idle: 0
 */
export function computeRestRemaining(
  restTimer: RestTimerState,
  now: number = Date.now(),
): number {
  if (restTimer.status === 'running' && restTimer.endsAt) {
    const ms = new Date(restTimer.endsAt).getTime() - now;
    return Math.max(0, Math.floor(ms / 1000));
  }
  if (restTimer.status === 'paused') {
    return restTimer.remainingSeconds;
  }
  return 0;
}

/** 休息计时是否已归零（仅 running 状态有意义） */
export function isRestTimerExpired(
  restTimer: RestTimerState,
  now: number = Date.now(),
): boolean {
  return restTimer.status === 'running' && computeRestRemaining(restTimer, now) <= 0;
}

/** 格式化休息时间为 mm:ss */
export function formatRestTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
}

/**
 * 启动休息计时器，返回新的 RestTimerState。
 * 无论之前是什么状态，都替换为新计时。
 */
export function startRestTimerState(
  durationSeconds: number,
  sessionExerciseId: string,
  now: number = Date.now(),
): RestTimerState {
  return {
    status: 'running',
    sessionExerciseId,
    durationSeconds,
    remainingSeconds: durationSeconds,
    endsAt: toLocalISOString(now + durationSeconds * 1000),
  };
}

/**
 * 暂停休息计时器：结算剩余秒数，清除 endsAt。
 */
export function pauseRestTimerState(
  restTimer: RestTimerState,
  now: number = Date.now(),
): RestTimerState {
  if (restTimer.status !== 'running') return restTimer;
  return {
    ...restTimer,
    status: 'paused',
    remainingSeconds: computeRestRemaining(restTimer, now),
    endsAt: null,
  };
}

/**
 * 恢复休息计时器：以 remainingSeconds 重新计算 endsAt。
 */
export function resumeRestTimerState(
  restTimer: RestTimerState,
  now: number = Date.now(),
): RestTimerState {
  if (restTimer.status !== 'paused') return restTimer;
  return {
    ...restTimer,
    status: 'running',
    endsAt: toLocalISOString(now + restTimer.remainingSeconds * 1000),
  };
}

// ============================================================================
// 有氧训练计时纯函数（与训练总计时相同的时间戳模型）
// ============================================================================

/** 计算有氧记录的当前累计秒数 */
export function computeCardioElapsedSeconds(
  record: CardioRecord | undefined,
  now: number = Date.now(),
): number {
  if (!record) return 0;
  const base = record.elapsedSeconds ?? 0;
  if (record.status === 'running' && record.runningSince) {
    const runningMs = now - new Date(record.runningSince).getTime();
    return base + Math.max(0, Math.floor(runningMs / 1000));
  }
  return base;
}

/** 启动有氧记录 */
export function startCardioRecord(
  targetDurationSeconds?: number,
  now: number = Date.now(),
): CardioRecord {
  const nowIso = toLocalISOString(now);
  return {
    status: 'running',
    startedAt: nowIso,
    elapsedSeconds: 0,
    runningSince: nowIso,
    targetDurationSeconds,
  };
}

/** 暂停有氧记录：结算当前运行区间 */
export function pauseCardioRecord(
  record: CardioRecord,
  now: number = Date.now(),
): CardioRecord {
  if (record.status !== 'running') return record;
  return {
    ...record,
    status: 'paused',
    elapsedSeconds: computeCardioElapsedSeconds(record, now),
    runningSince: null,
  };
}

/** 恢复有氧记录：保留 elapsedSeconds，设新 runningSince */
export function resumeCardioRecord(
  record: CardioRecord,
  now: number = Date.now(),
): CardioRecord {
  if (record.status !== 'paused') return record;
  return {
    ...record,
    status: 'running',
    runningSince: toLocalISOString(now),
  };
}

/** 完成有氧记录：结算最后运行区间，设 endedAt */
export function completeCardioRecord(
  record: CardioRecord,
  metrics: Partial<Pick<CardioRecord, 'speed' | 'incline' | 'distance' | 'calories' | 'pace' | 'resistance' | 'rpe'>> = {},
  now: number = Date.now(),
): CardioRecord {
  return {
    ...record,
    ...pauseCardioRecord(record, now),
    status: 'completed',
    endedAt: toLocalISOString(now),
    ...metrics,
  };
}

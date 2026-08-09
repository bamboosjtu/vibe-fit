import type { TrainingSession } from '../types';

type SqliteRow = Record<string, unknown>;

function parsePayload(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || raw.length === 0) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * SQLite 的 sessions.payload 必须保留 TrainingSession 中未单独建列的全部字段。
 * 统一在这里维护映射，避免新增会话字段时写入、导入和读取逻辑发生漂移。
 */
export function createSessionPayload(session: TrainingSession): Record<string, unknown> {
  return {
    planId: session.planId,
    planName: session.planName,
    dayId: session.dayId,
    dayName: session.dayName,
    exercises: session.exercises,
    notes: session.notes,
    timerStatus: session.timerStatus,
    elapsedSeconds: session.elapsedSeconds,
    runningSince: session.runningSince,
    lastCheckpointAt: session.lastCheckpointAt,
  };
}

export function sessionFromSqliteRow(row: SqliteRow): TrainingSession {
  const payload = parsePayload(row.payload);

  return {
    id: row.id as string,
    planId: (row.plan_id as string | null) ?? (payload.planId as string | undefined),
    planName: payload.planName as string | undefined,
    dayId: payload.dayId as string | undefined,
    dayName: payload.dayName as string | undefined,
    startedAt: row.started_at as string,
    endedAt: (row.ended_at as string | null) ?? undefined,
    exercises: (payload.exercises as TrainingSession['exercises']) ?? [],
    notes: payload.notes as string | undefined,
    timerStatus: payload.timerStatus as TrainingSession['timerStatus'],
    elapsedSeconds: payload.elapsedSeconds as number | undefined,
    runningSince: payload.runningSince as string | null | undefined,
    lastCheckpointAt: payload.lastCheckpointAt as string | undefined,
  };
}

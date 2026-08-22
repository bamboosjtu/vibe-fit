import { describe, expect, it } from 'vitest';
import {
  createSessionPayload,
  sessionFromSqliteRow,
} from '../src/db/sqliteSessionMapper';
import type { TrainingSession } from '../src/types';

const session: TrainingSession = {
  id: 'session-1',
  planId: 'plan-1',
  planName: '推拉腿',
  dayId: 'day-1',
  dayName: '推日',
  startedAt: '2026-08-08T08:00:00.000Z',
  endedAt: '2026-08-08T08:30:00.000Z',
  exercises: [],
  notes: '状态良好',
  timerStatus: 'completed',
  elapsedSeconds: 1500,
  runningSince: null,
  lastCheckpointAt: '2026-08-08T08:25:00.000Z',
};

describe('SQLite 会话映射', () => {
  it('保留计划快照和全部计时字段', () => {
    const payload = createSessionPayload(session);
    const restored = sessionFromSqliteRow({
      id: session.id,
      plan_id: session.planId,
      started_at: session.startedAt,
      ended_at: session.endedAt,
      payload: JSON.stringify(payload),
    });

    expect(restored).toEqual(session);
  });

  it('顶层 plan_id 优先于旧 payload 中的 planId', () => {
    const restored = sessionFromSqliteRow({
      id: session.id,
      plan_id: 'plan-new',
      started_at: session.startedAt,
      ended_at: null,
      payload: JSON.stringify({ ...createSessionPayload(session), planId: 'plan-old' }),
    });

    expect(restored.planId).toBe('plan-new');
    expect(restored.endedAt).toBeUndefined();
  });
});

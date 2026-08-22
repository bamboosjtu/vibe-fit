import { describe, expect, it } from 'vitest';
import { getCardioStats } from '../src/domain/historyStats';
import { formatHistoryDuration } from '../src/utils/helpers';
import type { TrainingSession } from '../src/types';

describe('formatHistoryDuration', () => {
  it.each([
    [0, '0秒'],
    [59, '59秒'],
    [60, '1分钟'],
    [3599, '59分钟'],
    [3600, '1小时0分钟'],
    [9000, '2小时30分钟'],
  ])('%i 秒格式化为 %s', (seconds, expected) => {
    expect(formatHistoryDuration(seconds)).toBe(expected);
  });
});

describe('getCardioStats', () => {
  it('只聚合有氧动作，距离统一以米累加', () => {
    const session: TrainingSession = {
      id: 'session-1',
      startedAt: '2026-08-08T08:00:00.000Z',
      exercises: [
        {
          id: 'treadmill-1',
          exerciseId: 'treadmill',
          exerciseName: '跑步机',
          type: 'cardio',
          order: 0,
          sets: [],
          cardioRecord: {
            status: 'completed',
            elapsedSeconds: 1200,
            distanceMeters: 4000,
          },
        },
        {
          id: 'rowing-1',
          exerciseId: 'rowing-machine',
          exerciseName: '划船机',
          type: 'cardio',
          order: 1,
          sets: [],
          cardioRecord: {
            status: 'completed',
            elapsedSeconds: 600,
            distanceMeters: 2000,
          },
        },
        {
          id: 'strength-1',
          exerciseId: 'bench-press',
          exerciseName: '卧推',
          type: 'strength',
          order: 2,
          sets: [],
        },
      ],
    };

    expect(getCardioStats(session)).toEqual({
      durationSeconds: 1800,
      distanceMeters: 6000,
      count: 2,
    });
  });

  it('保留已添加但尚未记录的有氧动作数', () => {
    const session: TrainingSession = {
      id: 'session-2',
      startedAt: '2026-08-08T08:00:00.000Z',
      exercises: [
        {
          id: 'elliptical-1',
          exerciseId: 'elliptical',
          exerciseName: '椭圆机',
          type: 'cardio',
          order: 0,
          sets: [],
        },
      ],
    };

    expect(getCardioStats(session)).toEqual({
      durationSeconds: 0,
      distanceMeters: 0,
      count: 1,
    });
  });
});

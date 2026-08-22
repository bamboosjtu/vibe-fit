import type { TrainingSession } from '../types';

export interface CardioStats {
  durationSeconds: number;
  distanceMeters: number;
  count: number;
}

/** 统计历史会话中的有氧时长、距离和动作数。 */
export function getCardioStats(session: TrainingSession): CardioStats {
  return session.exercises.reduce<CardioStats>(
    (stats, exercise) => {
      if (exercise.type !== 'cardio') return stats;

      stats.count += 1;
      stats.durationSeconds += exercise.cardioRecord?.elapsedSeconds ?? 0;
      stats.distanceMeters += exercise.cardioRecord?.distanceMeters ?? 0;
      return stats;
    },
    { durationSeconds: 0, distanceMeters: 0, count: 0 },
  );
}

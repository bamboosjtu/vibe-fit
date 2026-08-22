import type { TrainingDay } from '../types';

/** 从当前位置向后环形查找下一个启用的训练日。 */
export function findNextActiveDayIndex(
  days: TrainingDay[],
  currentDayIndex: number,
): number | null {
  if (days.length === 0) return null;

  const normalizedCurrent = ((currentDayIndex % days.length) + days.length) % days.length;

  for (let offset = 1; offset <= days.length; offset++) {
    const candidateIndex = (normalizedCurrent + offset) % days.length;
    if (days[candidateIndex].isActive) return candidateIndex;
  }

  return null;
}

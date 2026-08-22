import { describe, expect, it } from 'vitest';
import { findNextActiveDayIndex } from '../src/domain/trainingPlan';
import type { TrainingDay } from '../src/types';

function makeDay(id: string, isActive: boolean): TrainingDay {
  return { id, name: id, phases: [], isActive, order: Number(id.slice(1)) };
}

describe('findNextActiveDayIndex', () => {
  it('跳过已停用的训练日', () => {
    const days = [makeDay('d0', true), makeDay('d1', false), makeDay('d2', true)];
    expect(findNextActiveDayIndex(days, 0)).toBe(2);
  });

  it('到达末尾后环回第一个启用日', () => {
    const days = [makeDay('d0', true), makeDay('d1', false), makeDay('d2', true)];
    expect(findNextActiveDayIndex(days, 2)).toBe(0);
  });

  it('没有启用日时返回 null', () => {
    const days = [makeDay('d0', false), makeDay('d1', false)];
    expect(findNextActiveDayIndex(days, 0)).toBeNull();
  });
});

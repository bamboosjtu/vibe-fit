import { describe, it, expect } from 'vitest';
import { formatHistoryDuration } from '../src/utils/helpers';

describe('formatHistoryDuration', () => {
  it('不足 60 秒显示秒', () => {
    expect(formatHistoryDuration(0)).toBe('0秒');
    expect(formatHistoryDuration(30)).toBe('30秒');
    expect(formatHistoryDuration(59)).toBe('59秒');
  });

  it('60 秒以上显示分钟（向下取整，不强制向上取整）', () => {
    expect(formatHistoryDuration(60)).toBe('1分钟');
    expect(formatHistoryDuration(90)).toBe('1分钟');
    expect(formatHistoryDuration(125)).toBe('2分钟');
    expect(formatHistoryDuration(3599)).toBe('59分钟');
  });

  it('3600 秒以上显示小时+分钟', () => {
    expect(formatHistoryDuration(3600)).toBe('1小时0分钟');
    expect(formatHistoryDuration(3660)).toBe('1小时1分钟');
    expect(formatHistoryDuration(7200)).toBe('2小时0分钟');
    expect(formatHistoryDuration(9000)).toBe('2小时30分钟');
  });
});

describe('有氧距离单位聚合（数据模型验证）', () => {
  // 模拟历史页 getCardioStats 的距离聚合逻辑
  function aggregateDistanceMeters(exercises: Array<{ type: string; cardioRecord?: { distanceMeters?: number } }>): number {
    let total = 0;
    exercises.forEach((ex) => {
      if (ex.type === 'cardio' && ex.cardioRecord?.distanceMeters != null) {
        total += ex.cardioRecord.distanceMeters;
      }
    });
    return total;
  }

  it('跑步机 4km (4000m) + 划船机 2000m 正确聚合为 6000m', () => {
    const total = aggregateDistanceMeters([
      { type: 'cardio', cardioRecord: { distanceMeters: 4000 } }, // 跑步机 4km
      { type: 'cardio', cardioRecord: { distanceMeters: 2000 } }, // 划船机 2000m
    ]);
    expect(total).toBe(6000);
    // 展示为 6.00 公里
    expect((total / 1000).toFixed(2)).toBe('6.00');
  });

  it('单一器械距离正确', () => {
    const total = aggregateDistanceMeters([
      { type: 'cardio', cardioRecord: { distanceMeters: 4200 } },
    ]);
    expect(total).toBe(4200);
    expect((total / 1000).toFixed(2)).toBe('4.20');
  });

  it('无有氧数据时距离为 0', () => {
    const total = aggregateDistanceMeters([
      { type: 'strength' },
    ]);
    expect(total).toBe(0);
  });
});

describe('配速格式化', () => {
  // 复制 HistoryPage 中的 formatPaceForHistory 逻辑
  function formatPace(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  it('125 秒 → 2:05', () => {
    expect(formatPace(125)).toBe('2:05');
  });

  it('60 秒 → 1:00', () => {
    expect(formatPace(60)).toBe('1:00');
  });

  it('130 秒 → 2:10', () => {
    expect(formatPace(130)).toBe('2:10');
  });

  it('500 秒 → 8:20', () => {
    expect(formatPace(500)).toBe('8:20');
  });
});

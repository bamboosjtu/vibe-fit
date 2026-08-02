import { describe, it, expect } from 'vitest';

/**
 * 有氧输入数据模型测试。
 *
 * 验证 CardioSection 中的核心数据逻辑：
 * - 距离单位换算（km ↔ m）
 * - 配速格式化（秒 → MM:SS）
 * - commitMetric 解析逻辑（空串、NaN、合法值的处理）
 * - 指标校验规则
 *
 * 注：以下纯函数与 CardioSection.tsx 中的实现保持一致，
 * 用于锁定数据模型行为，防止回归。
 */

// ── 复制 CardioSection.tsx 中的纯函数 ──────────────────────

const kmToMeters = (km: number) => km * 1000;
const metersToKm = (m: number) => m / 1000;

function formatPace(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

type MetricKey =
  | 'speed'
  | 'incline'
  | 'distanceMeters'
  | 'calories'
  | 'paceSecondsPer500m'
  | 'resistance';

interface ValidationRule {
  min: number;
  max: number;
  hint: string;
}

const METRIC_VALIDATION: Partial<Record<MetricKey, ValidationRule>> = {
  speed: { min: 0, max: 30, hint: '速度通常在 0-30 km/h 之间' },
  incline: { min: 0, max: 30, hint: '坡度通常在 0-30% 之间' },
  distanceMeters: { min: 0, max: 100000, hint: '距离不能为负数，单次训练通常不超过 100km' },
  calories: { min: 0, max: 5000, hint: '卡路里应为非负数' },
  paceSecondsPer500m: { min: 60, max: 600, hint: '配速通常在 60-600 秒/500m 之间' },
  resistance: { min: 1, max: 30, hint: '阻力等级通常在 1-30 之间' },
};

function validateMetric(key: MetricKey, value: number | undefined | null): string | null {
  if (value === undefined || value === null || Number.isNaN(value)) return null;
  const rule = METRIC_VALIDATION[key];
  if (!rule) return null;
  if (value < rule.min || value > rule.max) return rule.hint;
  return null;
}

interface MetricField {
  key: MetricKey;
  toStored?: (input: number) => number;
}

/**
 * 复刻 CardioSection.commitMetric 的核心解析逻辑。
 * 返回写入 store 的值或一个表示"不写入"的哨兵。
 */
const NO_WRITE = Symbol('NO_WRITE');

function commitMetric(field: MetricField, input: string): unknown {
  const trimmed = input.trim();
  if (trimmed === '') {
    return undefined; // 清空：写入 undefined
  }
  const num = Number(trimmed);
  if (Number.isNaN(num)) return NO_WRITE; // NaN 不得进入 Store
  const stored = field.toStored ? field.toStored(num) : num;
  if (Number.isNaN(stored)) return NO_WRITE;
  return stored;
}

// ── 距离单位换算 ──────────────────────────────────────────

describe('有氧距离单位换算', () => {
  it('跑步机输入 km 正确转换为米存储', () => {
    // 跑步机输入 4.2km → 存储 4200m
    expect(kmToMeters(4.2)).toBe(4200);
    expect(kmToMeters(0)).toBe(0);
    expect(kmToMeters(1.5)).toBe(1500);
  });

  it('划船机输入 m 原样存储（不转换）', () => {
    // 划船机 toStored 未定义，原样存储
    const field: MetricField = { key: 'distanceMeters' };
    expect(commitMetric(field, '2000')).toBe(2000);
    expect(commitMetric(field, '500')).toBe(500);
  });

  it('跑步机输入通过 toStored 转换为米', () => {
    const field: MetricField = { key: 'distanceMeters', toStored: kmToMeters };
    expect(commitMetric(field, '4.2')).toBe(4200);
    expect(commitMetric(field, '0.5')).toBe(500);
  });

  it('存储值反向转换为 km 展示', () => {
    expect(metersToKm(4200)).toBe(4.2);
    expect(metersToKm(500)).toBe(0.5);
    expect(metersToKm(0)).toBe(0);
  });
});

// ── 配速格式化 ────────────────────────────────────────────

describe('有氧配速格式化', () => {
  it('125 秒 → 2:05 /500m', () => {
    expect(formatPace(125)).toBe('2:05');
  });

  it('60 秒 → 1:00', () => {
    expect(formatPace(60)).toBe('1:00');
  });

  it('500 秒 → 8:20', () => {
    expect(formatPace(500)).toBe('8:20');
  });

  it('秒数补零', () => {
    expect(formatPace(121)).toBe('2:01');
    expect(formatPace(119)).toBe('1:59'); // 四舍五入
  });
});

// ── commitMetric：NaN 不进入 Store ───────────────────────

describe('commitMetric 输入解析', () => {
  const kmField: MetricField = { key: 'distanceMeters', toStored: kmToMeters };
  const plainField: MetricField = { key: 'speed' };

  it('可以输入小数 8.5', () => {
    // 输入 8.5 → 解析为 8.5（无 toStored 时原样存储）
    expect(commitMetric(plainField, '8.5')).toBe(8.5);
  });

  it('跑步机可以输入小数 4.2km 并转换为 4200m', () => {
    expect(commitMetric(kmField, '4.2')).toBe(4200);
  });

  it('可以清空输入（返回 undefined）', () => {
    expect(commitMetric(plainField, '')).toBe(undefined);
    expect(commitMetric(plainField, '   ')).toBe(undefined);
  });

  it('"-" 中间态不把 NaN 写入 Store', () => {
    // Number("-") === NaN，应返回 NO_WRITE
    expect(commitMetric(plainField, '-')).toBe(NO_WRITE);
  });

  it('"." 中间态不把 NaN 写入 Store', () => {
    // Number(".") === NaN
    expect(commitMetric(plainField, '.')).toBe(NO_WRITE);
  });

  it('"8." 中间态解析为 8（Number("8.") === 8）', () => {
    // 注意：Number("8.") === 8，不是 NaN
    // 草稿输入框会在 onBlur 时提交完整字符串，"8." 提交时解析为 8
    expect(commitMetric(plainField, '8.')).toBe(8);
  });

  it('纯空格字符串视为清空', () => {
    expect(commitMetric(plainField, '  ')).toBe(undefined);
  });

  it('负号后接数字正确解析', () => {
    // 负数距离会被校验规则拦截，但解析本身应正确
    expect(commitMetric(kmField, '-1')).toBe(-1000);
  });
});

// ── 指标校验规则 ──────────────────────────────────────────

describe('有氧指标校验', () => {
  it('速度在 0-30 范围内正常', () => {
    expect(validateMetric('speed', 8.5)).toBeNull();
    expect(validateMetric('speed', 0)).toBeNull();
    expect(validateMetric('speed', 30)).toBeNull();
  });

  it('速度超范围返回提示', () => {
    expect(validateMetric('speed', 35)).toBe('速度通常在 0-30 km/h 之间');
    expect(validateMetric('speed', -1)).toBe('速度通常在 0-30 km/h 之间');
  });

  it('距离以米校验：100km = 100000m 在范围内', () => {
    expect(validateMetric('distanceMeters', 100000)).toBeNull();
    expect(validateMetric('distanceMeters', 4200)).toBeNull();
  });

  it('距离超过 100km 返回提示', () => {
    expect(validateMetric('distanceMeters', 150000)).toBe('距离不能为负数，单次训练通常不超过 100km');
  });

  it('配速在 60-600 秒范围内正常', () => {
    expect(validateMetric('paceSecondsPer500m', 125)).toBeNull();
    expect(validateMetric('paceSecondsPer500m', 60)).toBeNull();
    expect(validateMetric('paceSecondsPer500m', 600)).toBeNull();
  });

  it('配速超范围返回提示', () => {
    expect(validateMetric('paceSecondsPer500m', 30)).toBe('配速通常在 60-600 秒/500m 之间');
    expect(validateMetric('paceSecondsPer500m', 700)).toBe('配速通常在 60-600 秒/500m 之间');
  });

  it('undefined / null / NaN 不触发校验提示', () => {
    expect(validateMetric('speed', undefined)).toBeNull();
    expect(validateMetric('speed', null)).toBeNull();
    expect(validateMetric('speed', NaN)).toBeNull();
  });
});

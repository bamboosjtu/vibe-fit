import { describe, it, expect } from 'vitest';
import {
  kmToMeters,
  metersToKm,
  formatPace,
  validateMetric,
  parseMetricInput,
  METRIC_VALIDATION,
  type MetricField,
} from '../src/domain/cardioMetrics';

/**
 * 有氧输入数据模型测试。
 *
 * 直接测试 domain/cardioMetrics.ts 中的纯函数，确保 CardioSection 的
 * 距离换算、配速格式化、输入解析、指标校验行为正确，防止回归。
 */

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
    const field: MetricField = { key: 'distanceMeters', label: '距离' };
    expect(parseMetricInput(field, '2000')).toBe(2000);
    expect(parseMetricInput(field, '500')).toBe(500);
  });

  it('跑步机输入通过 toStored 转换为米', () => {
    const field: MetricField = { key: 'distanceMeters', label: '距离', toStored: kmToMeters };
    expect(parseMetricInput(field, '4.2')).toBe(4200);
    expect(parseMetricInput(field, '0.5')).toBe(500);
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

// ── parseMetricInput：NaN 不进入 Store ───────────────────

describe('parseMetricInput 输入解析', () => {
  const kmField: MetricField = { key: 'distanceMeters', label: '距离', toStored: kmToMeters };
  const plainField: MetricField = { key: 'speed', label: '速度' };

  it('可以输入小数 8.5', () => {
    // 输入 8.5 → 解析为 8.5（无 toStored 时原样存储）
    expect(parseMetricInput(plainField, '8.5')).toBe(8.5);
  });

  it('跑步机可以输入小数 4.2km 并转换为 4200m', () => {
    expect(parseMetricInput(kmField, '4.2')).toBe(4200);
  });

  it('可以清空输入（返回 undefined）', () => {
    expect(parseMetricInput(plainField, '')).toBe(undefined);
    expect(parseMetricInput(plainField, '   ')).toBe(undefined);
  });

  it('"-" 中间态不把 NaN 写入 Store（返回 null）', () => {
    // Number("-") === NaN，应返回 null
    expect(parseMetricInput(plainField, '-')).toBe(null);
  });

  it('"." 中间态不把 NaN 写入 Store（返回 null）', () => {
    // Number(".") === NaN
    expect(parseMetricInput(plainField, '.')).toBe(null);
  });

  it('"8." 中间态解析为 8（Number("8.") === 8）', () => {
    // 注意：Number("8.") === 8，不是 NaN
    // 草稿输入框会在 onBlur 时提交完整字符串，"8." 提交时解析为 8
    expect(parseMetricInput(plainField, '8.')).toBe(8);
  });

  it('纯空格字符串视为清空', () => {
    expect(parseMetricInput(plainField, '  ')).toBe(undefined);
  });

  it('负号后接数字正确解析', () => {
    // 负数距离会被校验规则拦截，但解析本身应正确
    expect(parseMetricInput(kmField, '-1')).toBe(-1000);
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

  it('METRIC_VALIDATION 覆盖所有关键指标', () => {
    // 确保校验规则不会意外丢失
    expect(METRIC_VALIDATION.speed).toBeDefined();
    expect(METRIC_VALIDATION.incline).toBeDefined();
    expect(METRIC_VALIDATION.distanceMeters).toBeDefined();
    expect(METRIC_VALIDATION.calories).toBeDefined();
    expect(METRIC_VALIDATION.paceSecondsPer500m).toBeDefined();
    expect(METRIC_VALIDATION.resistance).toBeDefined();
  });
});

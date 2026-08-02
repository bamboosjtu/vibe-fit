/**
 * 有氧训练指标：纯函数与配置。
 *
 * 从 CardioSection.tsx 提取，供组件与测试共享，避免复制粘贴导致行为漂移。
 * 详见 docs/ui/today/ui-brief.md 第 6.3 节。
 */

/** 有氧器械可记录的指标字段 */
export type MetricKey =
  | 'speed'
  | 'incline'
  | 'distanceMeters'
  | 'calories'
  | 'paceSecondsPer500m'
  | 'resistance'
  | 'rpe';

/** 指标字段配置：定义输入单位、换算与展示方式 */
export interface MetricField {
  key: MetricKey;
  label: string;
  /** 输入框显示的单位文案 */
  inputUnit?: string;
  /**
   * 输入框数值 → 存储值的换算（如 km → m）。
   * 默认原样存储。
   */
  toStored?: (input: number) => number;
  /**
   * 存储值 → 完成态展示字符串。
   * 默认按 inputUnit 拼接。
   */
  toDisplay?: (stored: number) => string;
}

/** 指标合理性校验规则（非阻塞，仅提示异常值） */
export interface ValidationRule {
  min: number;
  max: number;
  hint: string;
}

/** 距离单位换算：跑步机/椭圆机输入 km，划船机输入 m，统一存米 */
export const kmToMeters = (km: number): number => km * 1000;
export const metersToKm = (m: number): number => m / 1000;

/** 配速：存储秒数，展示 MM:SS */
export function formatPace(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * 器械指标字段配置。
 * 不同器械展示不同的指标输入，数据结构支持后续扩展。
 */
export const EQUIPMENT_METRICS: Record<string, MetricField[]> = {
  // 跑步机：时长、速度、坡度、距离、卡路里
  treadmill: [
    { key: 'speed', label: '速度', inputUnit: 'km/h' },
    { key: 'incline', label: '坡度', inputUnit: '%' },
    { key: 'distanceMeters', label: '距离', inputUnit: 'km', toStored: kmToMeters, toDisplay: (m) => `${metersToKm(m).toFixed(2)} km` },
    { key: 'calories', label: '卡路里', inputUnit: 'kcal' },
  ],
  // 椭圆机：时长、阻力等级、距离、卡路里
  elliptical: [
    { key: 'resistance', label: '阻力等级' },
    { key: 'distanceMeters', label: '距离', inputUnit: 'km', toStored: kmToMeters, toDisplay: (m) => `${metersToKm(m).toFixed(2)} km` },
    { key: 'calories', label: '卡路里', inputUnit: 'kcal' },
  ],
  // 划船机：时长、距离、平均配速、阻力等级
  'rowing-machine': [
    { key: 'distanceMeters', label: '距离', inputUnit: 'm', toDisplay: (m) => `${Math.round(m)} m` },
    { key: 'paceSecondsPer500m', label: '平均配速', inputUnit: '秒', toDisplay: (s) => `${formatPace(s)} /500m` },
    { key: 'resistance', label: '阻力等级' },
  ],
};

/**
 * 指标合理性校验规则（非阻塞，仅提示异常值）。
 * 注意：min/max 针对存储后的值（米/秒）。
 */
export const METRIC_VALIDATION: Partial<Record<MetricKey, ValidationRule>> = {
  speed: { min: 0, max: 30, hint: '速度通常在 0-30 km/h 之间' },
  incline: { min: 0, max: 30, hint: '坡度通常在 0-30% 之间' },
  // 距离以米存储：100km = 100000m
  distanceMeters: { min: 0, max: 100000, hint: '距离不能为负数，单次训练通常不超过 100km' },
  calories: { min: 0, max: 5000, hint: '卡路里应为非负数' },
  paceSecondsPer500m: { min: 60, max: 600, hint: '配速通常在 60-600 秒/500m 之间' },
  resistance: { min: 1, max: 30, hint: '阻力等级通常在 1-30 之间' },
};

/** 校验单个指标值：返回异常提示文案，正常时返回 null */
export function validateMetric(key: MetricKey, value: number | undefined | null): string | null {
  if (value === undefined || value === null || Number.isNaN(value)) return null;
  const rule = METRIC_VALIDATION[key];
  if (!rule) return null;
  if (value < rule.min || value > rule.max) return rule.hint;
  return null;
}

/**
 * 解析输入框字符串为存储值（纯函数，不写入 store）。
 *
 * @returns 存储值；空串返回 undefined（清空）；NaN 返回 null（不写入）
 */
export function parseMetricInput(field: Pick<MetricField, 'toStored'>, input: string): number | undefined | null {
  const trimmed = input.trim();
  if (trimmed === '') return undefined; // 清空
  const num = Number(trimmed);
  if (Number.isNaN(num)) return null; // NaN 不得进入 Store
  const stored = field.toStored ? field.toStored(num) : num;
  if (Number.isNaN(stored)) return null;
  return stored;
}

/**
 * 将存储值转换为输入框展示字符串（如 distanceMeters → km）。
 */
export function metricToInputDisplay(
  field: MetricField,
  stored: number | undefined | null,
): string {
  if (stored === undefined || stored === null || typeof stored !== 'number') return '';
  // 距离：米 → km（仅当 toStored 存在且为 km→m 换算时反向转换）
  if (field.key === 'distanceMeters' && field.toStored === kmToMeters) {
    return String(metersToKm(stored));
  }
  return String(stored);
}

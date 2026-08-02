/**
 * 动作资源 manifest
 *
 * 设计原则：
 * - 所有图片通过 `exerciseId` 显式映射，禁止通过动作名称/中文名称/正则猜测
 * - 力量动作：50 个动作均有对应 PNG，位于 /assets/exercises/<id>.png
 * - 有氧动作：3 类（treadmill/elliptical/rowing-machine）暂无图片，使用统一占位
 * - 资源缺失时开发环境输出警告，生产环境静默回退到占位
 *
 * 文件名规则：
 * - 使用 exerciseId 作为文件名（kebab-case，全小写）
 * - 不再使用中文名或带特殊字符（/、括号）的文件名
 * - 旧的中文名 PNG 文件已重命名为 <exerciseId>.png
 *
 * 资源迁移历史：
 * - 原文件名：杠铃_哑铃_史密斯卧推（水平推）.png
 * - 新文件名：bench-press.png（与 exerciseId 一致）
 */

/** 力量动作资源映射：exerciseId → PNG 文件名 */
export const STRENGTH_ASSET_MAP: Record<string, string> = {
  // 背 - 下拉
  'pull-up': 'pull-up.png',
  'lat-pulldown': 'lat-pulldown.png',
  'machine-pulldown': 'machine-pulldown.png',
  // 背 - 划船
  'barbell-row': 'barbell-row.png',
  't-bar-row': 't-bar-row.png',
  'seated-cable-row': 'seated-cable-row.png',
  'dumbbell-row': 'dumbbell-row.png',
  'straight-arm-pulldown': 'straight-arm-pulldown.png',
  // 肩后束
  'rear-delt-fly': 'rear-delt-fly.png',
  'reverse-pec-deck': 'reverse-pec-deck.png',
  'cable-rear-delt': 'cable-rear-delt.png',
  'seated-row-rear-delt': 'seated-row-rear-delt.png',
  // 肱二头
  'dumbbell-curl': 'dumbbell-curl.png',
  'barbell-curl': 'barbell-curl.png',
  'concentration-curl': 'concentration-curl.png',
  'machine-curl': 'machine-curl.png',
  'preacher-curl': 'preacher-curl.png',
  // 胸 - 中胸
  'bench-press': 'bench-press.png',
  'machine-chest-press': 'machine-chest-press.png',
  'pec-deck': 'pec-deck.png',
  'cable-crossover': 'cable-crossover.png',
  // 胸 - 下胸
  'cable-crossover-lower': 'cable-crossover-lower.png',
  'cable-crossover-decline': 'cable-crossover-decline.png',
  'decline-machine-press': 'decline-machine-press.png',
  'decline-press': 'decline-press.png',
  'dips': 'dips.png',
  // 胸 - 上胸
  'incline-press': 'incline-press.png',
  'incline-machine-press': 'incline-machine-press.png',
  'incline-cable-crossover': 'incline-cable-crossover.png',
  // 肩前束
  'shoulder-press': 'shoulder-press.png',
  'front-raise': 'front-raise.png',
  // 肩中束
  'lateral-raise': 'lateral-raise.png',
  'upright-row': 'upright-row.png',
  // 肱三头
  'tricep-pushdown-bar': 'tricep-pushdown-bar.png',
  'tricep-pushdown-rope': 'tricep-pushdown-rope.png',
  'overhead-tricep': 'overhead-tricep.png',
  'skull-crusher': 'skull-crusher.png',
  'close-grip-bench': 'close-grip-bench.png',
  // 腿臀 - 股四头肌
  'squat': 'squat.png',
  'leg-extension': 'leg-extension.png',
  // 腿臀 - 腘绳肌
  'romanian-deadlift': 'romanian-deadlift.png',
  'leg-curl': 'leg-curl.png',
  // 腿臀 - 臀大肌
  'machine-hip-thrust': 'machine-hip-thrust.png',
  'barbell-hip-thrust': 'barbell-hip-thrust.png',
  // 腿臀 - 兼练动作
  'hack-squat': 'hack-squat.png',
  'leg-press': 'leg-press.png',
  'lunges': 'lunges.png',
  'smith-squat': 'smith-squat.png',
  // 腹
  'crunch': 'crunch.png',
  'hanging-leg-raise': 'hanging-leg-raise.png',
};

/** 有氧动作无 PNG 资源，使用占位 */
export const CARDIO_NO_ASSET_IDS = new Set(['treadmill', 'elliptical', 'rowing-machine']);

/** 占位图片的固定背景色（品牌绿淡化） */
export const PLACEHOLDER_BG = 'rgba(16, 185, 129, 0.1)';

/** 资源根路径 */
export const ASSET_BASE = '/assets/exercises';

/**
 * 通过 exerciseId 获取图片路径。
 * - 力量动作：返回 /assets/exercises/<id>.png
 * - 有氧动作：返回 null（由组件渲染占位）
 * - 未知 exerciseId：开发环境警告，返回 null
 */
export function getExerciseImagePath(exerciseId: string, exerciseType?: 'strength' | 'cardio'): string | null {
  // 有氧动作无图片资源
  if (exerciseType === 'cardio' || CARDIO_NO_ASSET_IDS.has(exerciseId)) {
    return null;
  }

  const fileName = STRENGTH_ASSET_MAP[exerciseId];
  if (!fileName) {
    if (import.meta.env?.DEV) {
      console.warn(`[exerciseAssets] 未找到 exerciseId="${exerciseId}" 的图片资源映射`);
    }
    return null;
  }

  return `${ASSET_BASE}/${fileName}`;
}

# 动作资源 manifest 规则

所有动作示意图通过 `exerciseId` 显式映射，禁止通过动作名称、中文名或正则猜测。源码定义见 [`pwa/frontend/src/constants/exerciseAssets.ts`](../../pwa/frontend/src/constants/exerciseAssets.ts)。

## manifest 规则

- 力量动作：50 个动作均有对应 PNG，映射表为 `STRENGTH_ASSET_MAP: Record<string, string>`；
- 有氧动作：`treadmill`、`elliptical`、`rowing-machine` 暂无图片，列入 `CARDIO_NO_ASSET_IDS`，由组件渲染占位；
- 资源根路径：`ASSET_BASE = '/assets/exercises'`；
- 取图函数：`getExerciseImagePath(exerciseId, exerciseType?)` 返回 `string | null`，UI 必须处理 `null`。

## exerciseId 映射

- `exerciseId` 是动作的唯一 key，使用 `kebab-case` 全小写；
- `STRENGTH_ASSET_MAP` 的 key 与 value 文件名严格一致，例如 `'bench-press' → 'bench-press.png'`；
- 新增动作时必须同时登记 `exerciseId`、动作库数据与 `STRENGTH_ASSET_MAP`，三处缺一不可。

## 文件命名

- 文件名 = `<exerciseId>.png`，全小写、kebab-case；
- 禁止中文名、空格、括号、`/` 等特殊字符；
- 旧的中文名 PNG（如 `杠铃_哑铃_史密斯卧推（水平推）.png`）已重命名为 `bench-press.png`，不再保留别名；
- 图片统一放在 `pwa/frontend/public/assets/exercises/`。

## 占位图策略

- 有氧动作或未知 `exerciseId`：`getExerciseImagePath` 返回 `null`；
- 组件渲染占位块，背景色使用 `PLACEHOLDER_BG = 'rgba(16, 185, 129, 0.1)'`（品牌绿淡化）；
- 开发环境（`import.meta.env.DEV`）对未知 `exerciseId` 输出 `console.warn`，生产环境静默回退；
- 占位不得显示「无图」文案，仅用品牌色块即可。

## 关联

- UI 层调用规则见 [`docs/ui/today/ui-brief.md`](../ui/today/ui-brief.md) 的「数据绑定」章节；
- 动作示意图只是辅助，不得代替动作名称文字。

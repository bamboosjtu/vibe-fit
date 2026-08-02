# 今日训练 UI Brief

> 状态：Baseline v1
> 适用范围：`pwa/frontend` 的 H5/PWA、Capacitor Android 复用界面
> 关联原型图：[`docs/ui_brief/今日训练.png`](../../ui_brief/今日训练.png)
> 配套规范：[`docs/design-system.md`](../../design-system.md)
> 数据契约：[`pwa/frontend/src/domain/trainingContext.ts`](../../../pwa/frontend/src/domain/trainingContext.ts)

## 1. 页面目标

让用户在健身房单手操作下，以最少点击完成「查看今天练什么 → 记录力量/有氧 → 自动进入组间休息 → 结束训练」的完整闭环，并保证训练中断后可恢复、页面切换不丢数据。

## 2. 用户任务

- 查看今日训练日、当前阶段和下一个动作；
- 开始 / 暂停 / 继续 / 结束整场训练；
- 在力量模式下记录每组重量与次数、完成组、跳过休息；
- 在有氧模式下记录时长、速度、坡度、距离等指标；
- 力量/有氧模式切换而不丢数据；
- 中断后恢复上次训练。

## 3. 页面结构

由上到下固定为：

1. **顶部应用栏**：左 `VibeFit` 品牌字样 / 中 `今日训练` / 右 训练总计时 + 状态点（准备开始 / 训练中 / 已暂停）。
2. **力量 / 有氧模式切换**：等宽双段控件，当前模式为品牌绿实底。
3. **训练上下文区**：训练日名称、Day 序号、状态标签、周期、预计时长、分段进度条、切换计划入口。
4. **训练阶段及动作卡片**：阶段卡片可展开/收起；动作卡片含头部信息 + 组记录表 + 休息计时条。
5. **底部粘性操作栏**：左侧 `添加动作`，右侧主操作（`开始训练` / `结束训练`）。
6. **底部主导航**：今日 / 计划 / 历史 / 设置。

层级：`TrainingSession → TrainingDay → TrainingPhase → ExerciseGroup → SessionExercise → SetRecord`。

## 4. 数据绑定

页面统一通过 `buildTrainingContext(currentPlan, todayDay, activeSession)` 生成 `TrainingContextViewModel`，不得在组件内临时拼接。类型定义见 `pwa/frontend/src/domain/trainingContext.ts`。

| UI 元素 | 字段来源 |
|---|---|
| 训练日名称 | `TrainingContextViewModel.dayName` |
| Day 序号 / 总日数 | `dayIndex` / `totalDays` |
| 整场训练状态 | `runtimeStatus: 'idle' \| 'running' \| 'paused' \| 'completed'` |
| 预计时长 | `estimatedMinutes`（无法估算时为 `null`，UI 隐藏） |
| 当前阶段序号 / 总阶段数 | `currentPhaseIndex` / `totalPhases` |
| 分段进度条 | `phases: PhaseSegment[]`，每段含 `status: 'completed' \| 'current' \| 'upcoming'`、`completedSets`、`totalSets` |
| 自由训练标识 | `isFreeTraining`（无计划时 `planName`/`dayIndex` 等为 `null`） |
| 训练总时长 | `TrainingSession.elapsedSeconds + runningSince` |
| 动作名称 | `SessionExercise.exerciseName` |
| 目标肌群 | `Exercise.muscleGroups`，禁止靠名称正则推断 |
| 完成组数 | `SetRecord.completedAt` 是否存在 |
| 休息时间 | `SessionExercise.restSeconds`，缺失时用 `DEFAULT_STRENGTH_REST_SECONDS` |
| 有氧状态 | `SessionExercise.cardioRecord.status` |
| 有氧实际时长 | `cardioRecord.elapsedSeconds + runningSince` |
| 动作示意图 | `getExerciseImagePath(exerciseId, exerciseType)`，详见 [`docs/assets/exercise-assets.md`](../../assets/exercise-assets.md) |

缺失字段必须隐藏对应 UI，禁止显示「待开发」占位文案。

## 5. 页面状态机

整场训练统一映射为 `SessionRuntimeStatus`：

```text
idle ──开始训练──▶ running ──暂停──▶ paused ──继续──▶ running
                    │                  │
                    └──结束训练──▶ completed
                    └──放弃──▶ idle（清空上下文）
```

- `idle`：无 `activeSession`，主操作为 `开始训练`；
- `running`：`timerStatus === 'running'`，总计时累加；
- `paused`：`timerStatus === 'paused'`，总计时停止，UI 显示「已暂停」；
- `completed`：`timerStatus === 'completed'`，等待写入历史后回到 `idle`。

**力量 / 有氧模式切换** 是与上述状态正交的本地视图状态：

- 切换不结束、不暂停训练，不清空另一模式数据；
- 有氧正在 `running` 时切到力量，有氧计时继续按时间戳计算；
- 力量休息计时切到有氧后继续按 `endsAt - now` 计算；
- 模式切换不得触发 `activeSession` 重建。

## 6. 交互规则

### 动作选择器

- 新增动作时必须显式传入 `phaseId` 和 `groupId`，禁止依赖隐式回退到 `groupId: 'legacy'`；
- 同一 `ExerciseGroup` 内已选动作需去重，避免同一 `exerciseId` 重复加入；
- 切换计划或开始新训练时，重置所有组件本地状态（展开/收起、动作选择器筛选条件、输入草稿），但不清空已持久化的 `SetRecord`。

### 组记录

- 完成组时立即持久化 `completedAt`；取消完成只清除 `completedAt`，保留用户输入；
- 重量允许小数，次数只允许非负整数，空值与 `0` 必须区分；
- 删除组放入行级菜单/滑动/长按，不常驻列。

### 休息计时

- 完成组后在该动作卡片内显示休息条；
- 完成其他动作的组时，当前休息被新计时替换；
- 整场暂停/结束/放弃时清空休息计时；
- 倒计时使用 `endsAt - now`，禁止用 `setInterval` 作为真实时间来源。

### 结束训练

- 存在 `running`/`paused` 有氧时，结束整场训练必须先弹出确认：完成有氧并结束 / 返回继续 / 放弃有氧并结束；
- 结束前等待 pending 写队列完成，避免删除 pending 后旧写入重建 session；
- 已有 `activeSession` 时不允许创建第二个。

## 7. 响应式规则

- **目标视口**：竖屏手机 360–430 CSS px；必须验证 375×812、390×844、430×932 三种视口。
- **桌面 / 宽屏**：今日训练页内容区 `max-width: 640px` 居中，两侧留白；不拉伸动作卡片至全宽。
- **动作选择器**：手机端用 Bottom Sheet（贴底、可上滑展开），桌面端用 Dialog（居中、最大宽度 480px）。
- **底部操作栏**：`position: sticky`，滚动容器底部预留操作栏高度 + Safe Area，不得遮挡最后一张卡片。
- **Safe Area**：顶部应用栏、底部操作栏、底部导航均使用 `env(safe-area-inset-*)` 内边距；Android Capacitor 同样依赖 `safe-area-inset`。
- **横屏**：不强制支持，但不得布局错乱到无法操作。

## 8. PWA 和 Android 差异

| 维度 | PWA (H5) | Android (Capacitor) |
|---|---|---|
| 数据存储 | Dexie / IndexedDB | 通过 `nativeBridge.ts` 写入本地 SQLite |
| 离线 | Service Worker 缓存壳与静态资源 | 原生离线，无网络依赖 |
| 后台计时 | 标签页隐藏时 `setInterval` 可能被节流，回前台用时间戳校准 | 通过原生能力保持计时，回前台校准 `runningSince` |
| Safe Area | `env(safe-area-inset-*)` | 同上，Capacitor 注入 insets |
| 文件路径 | `/assets/exercises/<id>.png` 走静态托管 | 同 PWA 路径，由 Capacitor WebView 解析 |
| 部署 | 本地 Docker / GCP，见 [`docs/platforms/pwa.md`](../../platforms/pwa.md) | 打包 APK，见 [`docs/platforms/android.md`](../../platforms/android.md) |

两者共用同一份 `pwa/frontend` 代码，差异通过 `nativeBridge.ts` 抽象，UI 层不写平台分支。

## 9. 加载、空状态和异常状态

- **加载中**：上下文区显示骨架屏，动作卡片不渲染；避免闪烁式占位文案。
- **无计划空状态**：不渲染虚假阶段/动作；显示空状态插画 + `选择训练计划` / `创建计划` / `进入自由训练` 三个入口。
- **未完成训练恢复**：异常中断后弹窗提供 `继续训练` / `结束上次训练` / `放弃训练`，不得因超过固定时长静默删除。
- **保存失败**：非阻塞错误提示，保留内存数据，不阻塞本地训练。
- **重复开始**：已有 `activeSession` 禁止创建第二个；已有 `running`/`paused` 有氧禁止启动另一个有氧。

## 10. 无障碍要求

- 所有主操作按钮提供 `data-testid`，命名采用 `kebab-case` 语义前缀，如 `start-session-btn`、`complete-set-btn`、`finish-session-btn`。
- 图标按钮必须带 `aria-label`，不得只用图标表达操作意图。
- 触控区域不小于 44×44 px；相邻可点击元素间距至少 8 px。
- 状态点/进度条需配 `aria-label` 或 `role="progressbar"` + `aria-valuenow`。
- 颜色不是唯一信息载体：完成组除绿色背景外，组号字体也加粗。
- 动作示意图只是辅助，不得代替动作名称文字。

## 11. 验收标准

### 今日训练

- [ ] 顶部上下文与原型图信息层级一致；
- [ ] 页面打开后 3 秒内能判断今天练什么、当前练到哪里；
- [ ] 单手可完成记录一组、跳过休息和结束训练；
- [ ] 力量/有氧切换不丢状态；
- [ ] 组间休息真实倒计时；
- [ ] 整场暂停后总计时停止；
- [ ] 有氧暂停后有氧计时停止，但整场训练计时继续；
- [ ] 页面刷新后训练可以恢复；
- [ ] 底部操作栏不遮挡内容；
- [ ] 375×812 / 390×844 / 430×932 三种视口布局正常。

### 历史（关联页面）

- [ ] 结束整场训练后立即出现记录；
- [ ] 仅有氧训练显示真实时长，不显示 `0 分钟`；
- [ ] 混合训练同时显示力量和有氧摘要；
- [ ] 历史展示不依赖组件本地状态。

## 12. 已知缺陷

- **再次记录覆盖**：`再次记录` 按钮在当前模型只允许单条 `cardioRecord` 时会静默覆盖上一条。临时方案：隐藏按钮或明确提示「重新记录将覆盖当前记录」。后续建议将 `cardioRecord` 扩展为数组。
- **pace/resistance 未持久化**：划船机平均配速、椭圆机/划船机阻力等级目前未进入持久化层，刷新后丢失。需扩展 `cardioRecord` schema 并迁移。
- **目标肌群推断**：部分动作仍靠名称正则推断肌群，应迁移到动作库静态数据。
- **历史轮询**：历史页存在 2 秒轮询，应改为只在页面聚焦时调用一次 `loadSessions()`。
- **结束训练竞态**：结束训练与 pending 写队列存在竞态，需等待队列清空后再删除 session。

## 13. 非本轮范围

- 社交动态、好友排行榜、关注关系；
- 训练记录分享到外部平台；
- 动作视频教程与播放器；
- 营养/饮食记录；
- 多用户/教练端。

## 14. 关联原型图

- [`docs/ui_brief/今日训练.png`](../../ui_brief/今日训练.png)

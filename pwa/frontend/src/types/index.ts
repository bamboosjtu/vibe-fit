import { z } from 'zod';

// 训练类型
export const ExerciseTypeSchema = z.enum(['strength', 'cardio']);
export type ExerciseType = z.infer<typeof ExerciseTypeSchema>;

// 重量单位
export const WeightUnitSchema = z.enum(['kg', 'lb']);
export type WeightUnit = z.infer<typeof WeightUnitSchema>;

// 距离单位
export const DistanceUnitSchema = z.enum(['km', 'mile']);
export type DistanceUnit = z.infer<typeof DistanceUnitSchema>;

// 动作
export const ExerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ExerciseTypeSchema,
  muscleGroups: z.array(z.string()).optional(),
  description: z.string().optional(),
  videoUrl: z.string().optional(),
});
export type Exercise = z.infer<typeof ExerciseSchema>;

// 力量训练默认休息时间（秒）
export const DEFAULT_STRENGTH_REST_SECONDS = 75;

// 训练组记录
export const SetRecordSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  setNumber: z.number(),
  weight: z.number().optional(), // 力量训练
  reps: z.number().optional(), // 力量训练
  duration: z.number().optional(), // 有氧训练（分钟）
  distance: z.number().optional(), // 有氧训练
  rpe: z.number().min(1).max(10).optional(), // 主观用力程度
  completedAt: z.string(), // ISO 日期字符串
});
export type SetRecord = z.infer<typeof SetRecordSchema>;

// 有氧训练单次记录（基于时间戳，setInterval 仅刷新显示）
export const CardioRecordSchema = z.object({
  status: z.enum(['idle', 'running', 'paused', 'completed']),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  elapsedSeconds: z.number().default(0),
  runningSince: z.string().nullable().optional(),
  targetDurationSeconds: z.number().optional(),
  // 运行中输入的指标字段：节流写入到 store，防止切换页签/刷新丢失
  speed: z.number().optional(), // km/h
  incline: z.number().optional(), // %
  // 统一以"米"为单位存储距离，UI 层按器械单位（km/m）换算
  distanceMeters: z.number().optional(),
  calories: z.number().optional(), // kcal
  // 划船机平均配速：秒 /500m。UI 显示为 MM:SS /500m
  paceSecondsPer500m: z.number().optional(),
  resistance: z.number().optional(), // 椭圆机/划船机阻力等级
  rpe: z.number().min(1).max(10).optional(),
});
export type CardioRecord = z.infer<typeof CardioRecordSchema>;

// 训练会话中的动作
export const SessionExerciseSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  exerciseName: z.string(),
  type: ExerciseTypeSchema,
  sets: z.array(SetRecordSchema),
  order: z.number(),
  phaseId: z.string().optional(),
  groupId: z.string().optional(),
  // 力量训练：组间休息时间（秒），从计划复制以避免后续修改计划影响历史记录
  restSeconds: z.number().optional(),
  // 有氧训练：单次有氧记录
  cardioRecord: CardioRecordSchema.optional(),
  // 动作来源：recommended（来自当前组推荐列表）/ library（来自全局搜索）
  source: z.enum(['recommended', 'library']).optional(),
});
export type SessionExercise = z.infer<typeof SessionExerciseSchema>;

// 休息计时器状态（基于时间戳，setInterval 仅刷新显示）
export interface RestTimerState {
  status: 'running' | 'paused' | 'idle';
  sessionExerciseId: string | null;
  durationSeconds: number;
  remainingSeconds: number; // 暂停时使用
  endsAt: string | null; // 运行时使用，ISO 时间戳
}

// 计时器状态
export const TimerStatusSchema = z.enum(['running', 'paused', 'completed']);
export type TimerStatus = z.infer<typeof TimerStatusSchema>;

// 训练会话
export const TrainingSessionSchema = z.object({
  id: z.string(),
  planId: z.string().optional(),
  // 计划名快照：会话创建时复制计划名，避免后续计划重命名/删除影响历史搜索
  planName: z.string().optional(),
  dayId: z.string().optional(),
  dayName: z.string().optional(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  exercises: z.array(SessionExerciseSchema),
  notes: z.string().optional(),
  // 计时器字段（保存在 payload JSON 中，无需升级 Dexie 表版本）
  timerStatus: TimerStatusSchema.optional(),
  elapsedSeconds: z.number().optional(),
  runningSince: z.string().nullable().optional(),
  lastCheckpointAt: z.string().optional(),
});
export type TrainingSession = z.infer<typeof TrainingSessionSchema>;

// 计划中的动作配置
export const PlanExerciseConfigSchema = z.object({
  exerciseId: z.string(),
  exerciseName: z.string(),
  type: ExerciseTypeSchema,
  targetSets: z.number().optional(),
  targetReps: z.number().optional(),
  targetDuration: z.number().optional(), // 有氧目标时长（分钟）
  restSeconds: z.number().optional(), // 力量训练组间休息（秒）
  order: z.number(),
});
export type PlanExerciseConfig = z.infer<typeof PlanExerciseConfigSchema>;

// 动作组（如：下拉组、划船组）
export const ExerciseGroupSchema = z.object({
  id: z.string(),
  name: z.string(), // 如："下拉", "划船"
  description: z.string().optional(), // 如："选1-2个动作 总共6-8组"
  availableExercises: z.array(PlanExerciseConfigSchema), // 可选动作库
  selectedExercises: z.array(PlanExerciseConfigSchema), // 已选择的动作
  targetTotalSets: z.number().optional(), // 目标总组数
  order: z.number(),
});
export type ExerciseGroup = z.infer<typeof ExerciseGroupSchema>;

// 训练阶段（如：背、肩后束、肱二头）
export const TrainingPhaseSchema = z.object({
  id: z.string(),
  name: z.string(), // 如："背", "肩后束", "肱二头"
  groups: z.array(ExerciseGroupSchema), // 动作组列表
  order: z.number(),
});
export type TrainingPhase = z.infer<typeof TrainingPhaseSchema>;

// 训练日
export const TrainingDaySchema = z.object({
  id: z.string(),
  name: z.string(),
  phases: z.array(TrainingPhaseSchema), // 阶段列表
  isActive: z.boolean().default(true),
  order: z.number(),
});
export type TrainingDay = z.infer<typeof TrainingDaySchema>;

// 训练计划
export const TrainingPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  days: z.array(TrainingDaySchema),
  isActive: z.boolean().default(true),
  isCurrent: z.boolean().default(false),
  currentDayIndex: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TrainingPlan = z.infer<typeof TrainingPlanSchema>;

// 应用设置
export const AppSettingsSchema = z.object({
  weightUnit: WeightUnitSchema.default('kg'),
  distanceUnit: DistanceUnitSchema.default('km'),
  darkMode: z.boolean().default(false),
  schemaVersion: z.number().default(1),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

// 导出数据格式
export const ExportDataSchema = z.object({
  schemaVersion: z.number(),
  exportedAt: z.string(),
  appVersion: z.string(),
  settings: AppSettingsSchema,
  plans: z.array(TrainingPlanSchema),
  sessions: z.array(TrainingSessionSchema),
  exercises: z.array(ExerciseSchema),
});
export type ExportData = z.infer<typeof ExportDataSchema>;

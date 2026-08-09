import { z } from "zod";

const ExerciseTypeSchema = z.enum(["strength", "cardio"]);

const ExerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ExerciseTypeSchema,
  muscleGroups: z.array(z.string()).optional(),
  description: z.string().optional(),
  videoUrl: z.string().optional(),
}).passthrough();

const SetRecordSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  setNumber: z.number(),
  weight: z.number().optional(),
  reps: z.number().optional(),
  duration: z.number().optional(),
  distance: z.number().optional(),
  rpe: z.number().min(1).max(10).optional(),
  completedAt: z.string(),
}).passthrough();

const CardioRecordSchema = z.object({
  status: z.enum(["idle", "running", "paused", "completed"]),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  elapsedSeconds: z.number().default(0),
  runningSince: z.string().nullable().optional(),
  targetDurationSeconds: z.number().optional(),
  speed: z.number().optional(),
  incline: z.number().optional(),
  distanceMeters: z.number().optional(),
  calories: z.number().optional(),
  paceSecondsPer500m: z.number().optional(),
  resistance: z.number().optional(),
  rpe: z.number().min(1).max(10).optional(),
}).passthrough();

const SessionExerciseSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  exerciseName: z.string(),
  type: ExerciseTypeSchema,
  sets: z.array(SetRecordSchema),
  order: z.number(),
  phaseId: z.string().optional(),
  groupId: z.string().optional(),
  restSeconds: z.number().optional(),
  cardioRecord: CardioRecordSchema.optional(),
  source: z.enum(["recommended", "library"]).optional(),
}).passthrough();

const TrainingSessionSchema = z.object({
  id: z.string(),
  planId: z.string().optional(),
  planName: z.string().optional(),
  dayId: z.string().optional(),
  dayName: z.string().optional(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  exercises: z.array(SessionExerciseSchema),
  notes: z.string().optional(),
  timerStatus: z.enum(["running", "paused", "completed"]).optional(),
  elapsedSeconds: z.number().optional(),
  runningSince: z.string().nullable().optional(),
  lastCheckpointAt: z.string().optional(),
}).passthrough();

const PlanExerciseConfigSchema = z.object({
  exerciseId: z.string(),
  exerciseName: z.string(),
  type: ExerciseTypeSchema,
  targetSets: z.number().optional(),
  targetReps: z.number().optional(),
  targetDuration: z.number().optional(),
  restSeconds: z.number().optional(),
  order: z.number(),
}).passthrough();

const ExerciseGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  availableExercises: z.array(PlanExerciseConfigSchema),
  selectedExercises: z.array(PlanExerciseConfigSchema),
  targetTotalSets: z.number().optional(),
  order: z.number(),
}).passthrough();

const TrainingPhaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  groups: z.array(ExerciseGroupSchema),
  order: z.number(),
}).passthrough();

const TrainingDaySchema = z.object({
  id: z.string(),
  name: z.string(),
  phases: z.array(TrainingPhaseSchema),
  isActive: z.boolean().default(true),
  order: z.number(),
}).passthrough();

const TrainingPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  days: z.array(TrainingDaySchema),
  isActive: z.boolean().default(true),
  isCurrent: z.boolean().default(false),
  currentDayIndex: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

const SettingsSchema = z.object({
  schemaVersion: z.number().default(1),
  weightUnit: z.enum(["kg", "lb"]).default("kg"),
  distanceUnit: z.enum(["km", "mile"]).default("km"),
  darkMode: z.boolean().default(false),
}).passthrough();

export const BackupPayloadSchema = z.object({
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string().datetime({ offset: true }),
  appVersion: z.string().trim().min(1).max(64),
  deviceId: z.string().trim().min(1).max(128).optional(),
  settings: SettingsSchema,
  plans: z.array(TrainingPlanSchema),
  sessions: z.array(TrainingSessionSchema),
  exercises: z.array(ExerciseSchema),
}).passthrough();

export type BackupPayload = z.infer<typeof BackupPayloadSchema>;

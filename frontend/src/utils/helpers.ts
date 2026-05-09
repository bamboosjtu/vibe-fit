import type { TrainingPlan, TrainingDay, Exercise } from '../types';

// 生成唯一ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 获取当前ISO时间字符串
export function getCurrentISOString(): string {
  return new Date().toISOString();
}

// 格式化日期显示
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

// 格式化时间显示
export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 格式化持续时间（分钟）
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}小时${mins}分钟`;
  }
  return `${mins}分钟`;
}

// 计算训练时长（分钟）
export function calculateSessionDuration(startedAt: string, endedAt?: string): number {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  return Math.round((end - start) / (1000 * 60));
}

// 重量单位转换
export function convertWeight(weight: number, from: 'kg' | 'lb', to: 'kg' | 'lb'): number {
  if (from === to) return weight;
  if (from === 'kg' && to === 'lb') {
    return Math.round(weight * 2.20462 * 10) / 10;
  }
  return Math.round(weight * 0.453592 * 10) / 10;
}

// 距离单位转换
export function convertDistance(distance: number, from: 'km' | 'mile', to: 'km' | 'mile'): number {
  if (from === to) return distance;
  if (from === 'km' && to === 'mile') {
    return Math.round(distance * 0.621371 * 100) / 100;
  }
  return Math.round(distance * 1.60934 * 100) / 100;
}

// 从模板创建计划
export function createPlanFromTemplate(
  template: Omit<TrainingPlan, 'id' | 'createdAt' | 'updatedAt'>,
  customName?: string
): TrainingPlan {
  const now = getCurrentISOString();
  return {
    ...template,
    id: generateId(),
    name: customName || template.name,
    currentDayIndex: 0,
    createdAt: now,
    updatedAt: now,
    days: template.days.map(day => ({
      ...day,
      id: generateId(),
      phases: day.phases.map(phase => ({
        ...phase,
        id: generateId(),
        groups: phase.groups.map(group => ({
            ...group,
            id: generateId(),
            availableExercises: group.availableExercises.map(ex => ({
              ...ex,
              id: generateId(),
            })),
            selectedExercises: group.selectedExercises.map(ex => ({
              ...ex,
              id: generateId(),
            })),
          })),
      })),
    })),
  };
}

// 创建空计划
export function createEmptyPlan(name: string): TrainingPlan {
  const now = getCurrentISOString();
  return {
    id: generateId(),
    name,
    description: '',
    days: [],
    isActive: true,
    isCurrent: false,
    currentDayIndex: 0,
    createdAt: now,
    updatedAt: now,
  };
}

// 创建训练日
export function createTrainingDay(name: string, order: number): TrainingDay {
  return {
    id: generateId(),
    name,
    phases: [],
    isActive: true,
    order,
  };
}

// 从动作库创建计划动作配置
export function createPlanExerciseFromExercise(
  exercise: Exercise,
  order: number,
  targetSets?: number,
  targetReps?: number
) {
  return {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    type: exercise.type,
    targetSets,
    targetReps,
    order,
  };
}

// 下载JSON文件
export function downloadJSON(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 读取JSON文件
export function readJSONFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = JSON.parse(e.target?.result as string);
        resolve(result);
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// 验证导出数据结构
export function validateExportData(data: unknown): data is {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  settings?: unknown;
  plans?: unknown[];
  sessions?: unknown[];
  exercises?: unknown[];
} {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.schemaVersion === 'number' &&
    typeof d.exportedAt === 'string' &&
    typeof d.appVersion === 'string'
  );
}

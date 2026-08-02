import type { TrainingPlan, TrainingDay, Exercise } from '../types';

// 生成唯一ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 将 Date 或时间戳转换为本地时区 ISO 字符串（带偏移，例如 2026-08-02T20:00:00.000+08:00）
// 与 new Date().toISOString()（总是 UTC Z 后缀）不同，这里保留本地时区信息，
// 便于直接阅读存储的时间。new Date() 解析两种格式得到同一时刻。
export function toLocalISOString(date: Date | number): string {
  const d = date instanceof Date ? date : new Date(date);
  const tzOffset = -d.getTimezoneOffset(); // 分钟，东半球为正
  const sign = tzOffset >= 0 ? '+' : '-';
  const abs = Math.abs(tzOffset);
  const offsetStr = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  // 用本地时间各字段拼出 YYYY-MM-DDTHH:mm:ss.sss
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  return `${local}${offsetStr}`;
}

// 获取当前本地时间 ISO 字符串
export function getCurrentISOString(): string {
  return toLocalISOString(new Date());
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

/**
 * 历史记录时长格式化（基于秒）：
 * - < 60s：显示秒（避免不足一分钟显示 0 分钟）
 * - < 1h：显示分钟
 * - >= 1h：显示小时+分钟
 * 不强制向上取整，保持准确性。
 */
export function formatHistoryDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}秒`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}分钟`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}小时${mins}分钟`;
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

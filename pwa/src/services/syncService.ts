import { post, get } from './apiClient';
import { exportAllData, importAllData } from '../db';
import { useAuthStore } from '../stores/authStore';
import { getCurrentISOString } from '../utils/helpers';
import { ExportDataSchema, type ExportData } from '../types';
import { APP_VERSION } from '../app/version';

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export interface SyncStatus {
  lastSyncedAt: string | null;
  hasBackup: boolean;
}

export async function syncPush() {
  if (!useAuthStore.getState().isAuthenticated()) {
    throw new Error('未登录，无法备份');
  }
  
  const data = await exportAllData();
  
  const payload = {
    schemaVersion: data.settings?.schemaVersion || 1,
    exportedAt: getCurrentISOString(),
    appVersion: APP_VERSION,
    settings: data.settings,
    plans: data.plans,
    sessions: data.sessions,
    exercises: data.exercises,
  };

  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  if (payloadBytes > MAX_BACKUP_BYTES) {
    throw new Error('备份数据超过 10MiB，请先导出本地 JSON 并检查数据量');
  }

  const response = await post<{ success: boolean; syncedAt: string }>('/api/backups', payload);

  return response;
}

export async function syncPull() {
  if (!useAuthStore.getState().isAuthenticated()) {
    throw new Error('未登录，无法恢复');
  }

  const response = await get<{ success: boolean; data: ExportData | null; syncedAt: string }>('/api/backups/latest');
  
  if (response.data) {
    const parsed = ExportDataSchema.safeParse(response.data);
    if (!parsed.success) {
      throw new Error('云端备份格式无效，已保留本地数据');
    }

    await importAllData({
      settings: parsed.data.settings,
      plans: parsed.data.plans,
      sessions: parsed.data.sessions,
      exercises: parsed.data.exercises,
    });
    return response;
  } else {
    throw new Error('云端没有备份数据');
  }
}

export async function getSyncStatus(): Promise<SyncStatus> {
  if (!useAuthStore.getState().isAuthenticated()) {
    return { lastSyncedAt: null, hasBackup: false };
  }

  try {
    const response = await get<{ success: boolean; data: ExportData | null; syncedAt: string | null }>('/api/backups/latest');
    return {
      lastSyncedAt: response.syncedAt,
      hasBackup: !!response.data,
    };
  } catch (error) {
    console.error('Failed to fetch sync status:', error);
    return { lastSyncedAt: null, hasBackup: false };
  }
}

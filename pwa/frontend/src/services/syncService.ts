import { post, get } from './apiClient';
import { exportAllData, importAllData } from '../db';
import { useAuthStore } from '../stores/authStore';
import type { ExportData } from '../types';

export interface SyncStatus {
  lastSyncedAt: string | null;
  hasBackup: boolean;
}

export async function syncPush() {
  if (!useAuthStore.getState().isAuthenticated()) {
    throw new Error('未登录，无法备份');
  }
  
  const data = await exportAllData();
  
  const response = await post<{ success: boolean; syncedAt: string }>('/api/backups', {
    schemaVersion: data.settings?.schemaVersion || 1,
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    settings: data.settings,
    plans: data.plans,
    sessions: data.sessions,
    exercises: data.exercises,
  });

  return response;
}

export async function syncPull() {
  if (!useAuthStore.getState().isAuthenticated()) {
    throw new Error('未登录，无法恢复');
  }

  const response = await get<{ success: boolean; data: ExportData | null; syncedAt: string }>('/api/backups/latest');
  
  if (response.data) {
    await importAllData({
      settings: response.data.settings,
      plans: response.data.plans,
      sessions: response.data.sessions,
      exercises: response.data.exercises,
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

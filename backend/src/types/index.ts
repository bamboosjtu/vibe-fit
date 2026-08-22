export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

export interface HealthzResponse {
  status: 'ok';
  timestamp: string;
  version: string;
}

export interface SyncPayload {
  userId: string;
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  settings?: unknown;
  plans?: unknown[];
  sessions?: unknown[];
  exercises?: unknown[];
}

export interface SyncPushResponse {
  success: boolean;
  syncedAt: string;
  message: string;
}

export interface SyncPullResponse {
  success: boolean;
  data: SyncPayload | null;
  syncedAt: string;
}

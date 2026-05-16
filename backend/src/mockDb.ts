export interface User {
  id: string;
  email: string;
  passwordHash: string | null;
  provider?: string;
  providerUserId?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface Settings {
  schemaVersion: number;
  weightUnit: string;
  distanceUnit: string;
  darkMode: boolean;
}

export interface SyncMeta {
  lastSyncedAt: Date;
  lastSyncStatus: string;
}

export const mockDb = {
  users: [] as User[],
  settings: new Map<string, Settings>(),
  plans: new Map<string, any[]>(),
  sessions: new Map<string, any[]>(),
  syncMeta: new Map<string, SyncMeta>(),

  clear() {
    this.users = [];
    this.settings.clear();
    this.plans.clear();
    this.sessions.clear();
    this.syncMeta.clear();
  },
};

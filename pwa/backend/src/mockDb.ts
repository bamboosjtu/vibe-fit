export interface User {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface EmailVerificationCode {
  id: string;
  email: string;
  code: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
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
  verificationCodes: [] as EmailVerificationCode[],
  settings: new Map<string, Settings>(),
  plans: new Map<string, any[]>(),
  sessions: new Map<string, any[]>(),
  syncMeta: new Map<string, SyncMeta>(),

  clear() {
    this.users = [];
    this.verificationCodes = [];
    this.settings.clear();
    this.plans.clear();
    this.sessions.clear();
    this.syncMeta.clear();
  },
};

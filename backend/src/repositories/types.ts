export interface UserRecord {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface UserWithStats extends UserRecord {
  createdAt: string | null;
  backupCount: number;
  lastBackupAt: string | null;
  lastSyncedAt: string | null;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;

  create(input: {
    email: string;
    name?: string | null;
    avatarUrl?: string | null;
  }): Promise<UserRecord>;

  listAll(): Promise<UserWithStats[]>;

  findStatsById(id: string): Promise<UserWithStats | null>;
}

export interface EmailVerificationCodeRecord {
  id: string;
  email: string;
  code: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface EmailVerificationCodeRepository {
  create(input: {
    email: string;
    code: string;
    expiresAt: Date;
  }): Promise<EmailVerificationCodeRecord>;

  findLatestByEmail(email: string): Promise<EmailVerificationCodeRecord | null>;

  markConsumed(id: string): Promise<void>;
}

export interface BackupRecord {
  id: string;
  userId: string;
  deviceId?: string | null;
  payload: unknown;
  createdAt: string;
}

export interface BackupRepository {
  create(input: {
    userId: string;
    deviceId?: string;
    payload: unknown;
  }): Promise<BackupRecord>;

  getLatestByUserId(userId: string): Promise<BackupRecord | null>;

  listByUserId(userId: string): Promise<BackupRecord[]>;

  findById(id: string): Promise<BackupRecord | null>;

  pruneExpiredByUserId(
    userId: string,
    options: { olderThan: Date; minToKeep: number },
  ): Promise<number>;
}

export interface Repositories {
  users: UserRepository;
  verificationCodes: EmailVerificationCodeRepository;
  backups: BackupRepository;
}

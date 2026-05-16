export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  provider?: string;
  providerUserId?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;

  create(input: {
    email: string;
    passwordHash?: string | null;
    provider?: string;
    providerUserId?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
  }): Promise<UserRecord>;

  findByProvider(input: {
    provider: string;
    providerUserId: string;
  }): Promise<UserRecord | null>;

  upsertGoogleUser(input: {
    email: string;
    providerUserId: string;
    name?: string | null;
    avatarUrl?: string | null;
  }): Promise<UserRecord>;
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
}

export interface Repositories {
  users: UserRepository;
  backups: BackupRepository;
}

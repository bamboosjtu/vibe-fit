export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
}

export interface BackupRecord {
  id: string;
  userId: string;
  deviceId?: string | null;
  payload: unknown;
  createdAt: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: { email: string; passwordHash: string }): Promise<UserRecord>;
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

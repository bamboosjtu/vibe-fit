import { randomUUID } from "crypto";
import { mockDb } from "../mockDb.js";
import type {
  BackupRecord,
  BackupRepository,
  Repositories,
  UserRecord,
  UserRepository,
} from "./types.js";

const mockBackupSnapshots: BackupRecord[] = [];

class MockUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<UserRecord | null> {
    return mockDb.users.find((user) => user.email === email) ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return mockDb.users.find((user) => user.id === id) ?? null;
  }

  async create(input: {
    email: string;
    passwordHash: string;
  }): Promise<UserRecord> {
    const user = {
      id: randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash,
    };

    mockDb.users.push(user);

    return user;
  }
}

class MockBackupRepository implements BackupRepository {
  async create(input: {
    userId: string;
    deviceId?: string;
    payload: unknown;
  }): Promise<BackupRecord> {
    const backup: BackupRecord = {
      id: randomUUID(),
      userId: input.userId,
      deviceId: input.deviceId ?? null,
      payload: input.payload,
      createdAt: new Date().toISOString(),
    };

    mockBackupSnapshots.push(backup);

    mockDb.syncMeta.set(input.userId, {
      lastSyncedAt: new Date(),
      lastSyncStatus: "success",
    });

    return backup;
  }

  async getLatestByUserId(userId: string): Promise<BackupRecord | null> {
    return (
      mockBackupSnapshots
        .filter((backup) => backup.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    );
  }
}

export const mockRepositories: Repositories = {
  users: new MockUserRepository(),
  backups: new MockBackupRepository(),
};

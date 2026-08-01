import { randomUUID } from "crypto";
import { mockDb } from "../mockDb.js";
import type {
  BackupRecord,
  BackupRepository,
  EmailVerificationCodeRecord,
  EmailVerificationCodeRepository,
  Repositories,
  UserRecord,
  UserRepository,
} from "./types.js";

const mockBackupSnapshots: BackupRecord[] = [];

function toUserRecord(user: {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}): UserRecord {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    avatarUrl: user.avatarUrl ?? null,
  };
}

class MockUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = mockDb.users.find((u) => u.email === email);
    return user ? toUserRecord(user) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = mockDb.users.find((u) => u.id === id);
    return user ? toUserRecord(user) : null;
  }

  async create(input: {
    email: string;
    name?: string | null;
    avatarUrl?: string | null;
  }): Promise<UserRecord> {
    const user = {
      id: randomUUID(),
      email: input.email,
      name: input.name ?? null,
      avatarUrl: input.avatarUrl ?? null,
    };

    mockDb.users.push(user);

    return toUserRecord(user);
  }
}

class MockEmailVerificationCodeRepository
  implements EmailVerificationCodeRepository
{
  async create(input: {
    email: string;
    code: string;
    expiresAt: Date;
  }): Promise<EmailVerificationCodeRecord> {
    const record: EmailVerificationCodeRecord = {
      id: randomUUID(),
      email: input.email,
      code: input.code,
      expiresAt: input.expiresAt,
      consumedAt: null,
      createdAt: new Date(),
    };

    mockDb.verificationCodes.push(record);

    return record;
  }

  async findLatestByEmail(
    email: string,
  ): Promise<EmailVerificationCodeRecord | null> {
    const codes = mockDb.verificationCodes
      .filter((c) => c.email === email)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return codes[0] ?? null;
  }

  async markConsumed(id: string): Promise<void> {
    const record = mockDb.verificationCodes.find((c) => c.id === id);

    if (record) {
      record.consumedAt = new Date();
    }
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
  verificationCodes: new MockEmailVerificationCodeRepository(),
  backups: new MockBackupRepository(),
};

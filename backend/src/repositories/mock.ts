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

  async findByProvider(input: {
    provider: string;
    providerUserId: string;
  }): Promise<UserRecord | null> {
    return (
      mockDb.users.find(
        (user) =>
          user.provider === input.provider &&
          user.providerUserId === input.providerUserId,
      ) ?? null
    );
  }

  async upsertGoogleUser(input: {
    email: string;
    providerUserId: string;
    name?: string | null;
    avatarUrl?: string | null;
  }): Promise<UserRecord> {
    const existingByProvider = await this.findByProvider({
      provider: "google",
      providerUserId: input.providerUserId,
    });

    if (existingByProvider) {
      existingByProvider.email = input.email;
      existingByProvider.name = input.name ?? null;
      existingByProvider.avatarUrl = input.avatarUrl ?? null;
      return existingByProvider;
    }

    const existingByEmail = await this.findByEmail(input.email);

    if (existingByEmail) {
      existingByEmail.provider = "google";
      existingByEmail.providerUserId = input.providerUserId;
      existingByEmail.name = input.name ?? null;
      existingByEmail.avatarUrl = input.avatarUrl ?? null;
      return existingByEmail;
    }

    return this.create({
      email: input.email,
      passwordHash: null,
      provider: "google",
      providerUserId: input.providerUserId,
      name: input.name ?? null,
      avatarUrl: input.avatarUrl ?? null,
    });
  }

  async create(input: {
    email: string;
    passwordHash?: string | null;
    provider?: string;
    providerUserId?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
  }): Promise<UserRecord> {
    const user = {
      id: randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash ?? null,
      provider: input.provider ?? "mock",
      providerUserId: input.providerUserId ?? null,
      name: input.name ?? null,
      avatarUrl: input.avatarUrl ?? null,
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

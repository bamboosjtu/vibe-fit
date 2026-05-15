import { prisma } from "../db/prisma.js";
import type {
  BackupRecord,
  BackupRepository,
  Repositories,
  UserRecord,
  UserRepository,
} from "./types.js";

function toUserRecord(user: {
  id: string;
  email: string;
  passwordHash: string | null;
  provider: string;
  providerUserId: string | null;
  name: string | null;
  avatarUrl: string | null;
}): UserRecord {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    provider: user.provider,
    providerUserId: user.providerUserId,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
}

class PostgresUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
    };
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
    };
  }

  async findByProvider(input: {
    provider: string;
    providerUserId: string;
  }): Promise<UserRecord | null> {
    const user = await prisma.user.findUnique({
      where: {
        provider_providerUserId: {
          provider: input.provider,
          providerUserId: input.providerUserId,
        },
      },
    });

    if (!user) return null;

    return toUserRecord(user);
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
      const user = await prisma.user.update({
        where: { id: existingByProvider.id },
        data: {
          email: input.email,
          name: input.name ?? null,
          avatarUrl: input.avatarUrl ?? null,
        },
      });

      return toUserRecord(user);
    }

    const existingByEmail = await this.findByEmail(input.email);

    if (existingByEmail) {
      const user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          provider: "google",
          providerUserId: input.providerUserId,
          name: input.name ?? null,
          avatarUrl: input.avatarUrl ?? null,
          passwordHash: existingByEmail.passwordHash,
        },
      });

      return toUserRecord(user);
    }

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash: null,
        provider: "google",
        providerUserId: input.providerUserId,
        name: input.name ?? null,
        avatarUrl: input.avatarUrl ?? null,
      },
    });

    return toUserRecord(user);
  }

  async create(input: {
    email: string;
    passwordHash?: string | null;
    provider?: string;
    providerUserId?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
  }): Promise<UserRecord> {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash ?? null,
        provider: input.provider ?? "mock",
        providerUserId: input.providerUserId ?? null,
        name: input.name ?? null,
        avatarUrl: input.avatarUrl ?? null,
      },
    });

    return toUserRecord(user);
  }
}

class PostgresBackupRepository implements BackupRepository {
  async create(input: {
    userId: string;
    deviceId?: string;
    payload: unknown;
  }): Promise<BackupRecord> {
    const backup = await prisma.backupSnapshot.create({
      data: {
        userId: input.userId,
        deviceId: input.deviceId ?? null,
        payload: input.payload as any,
      },
    });

    await prisma.syncMeta.upsert({
      where: {
        userId: input.userId,
      },
      update: {
        lastSyncedAt: new Date(),
        lastSyncStatus: "success",
      },
      create: {
        userId: input.userId,
        lastSyncedAt: new Date(),
        lastSyncStatus: "success",
      },
    });

    return {
      id: backup.id,
      userId: backup.userId,
      deviceId: backup.deviceId,
      payload: backup.payload,
      createdAt: backup.createdAt.toISOString(),
    };
  }

  async getLatestByUserId(userId: string): Promise<BackupRecord | null> {
    const backup = await prisma.backupSnapshot.findFirst({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!backup) return null;

    return {
      id: backup.id,
      userId: backup.userId,
      deviceId: backup.deviceId,
      payload: backup.payload,
      createdAt: backup.createdAt.toISOString(),
    };
  }
}

export const postgresRepositories: Repositories = {
  users: new PostgresUserRepository(),
  backups: new PostgresBackupRepository(),
};

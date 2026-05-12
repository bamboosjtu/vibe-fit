import { prisma } from "../db/prisma.js";
import type {
  BackupRecord,
  BackupRepository,
  Repositories,
  UserRecord,
  UserRepository,
} from "./types.js";

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

  async create(input: {
    email: string;
    passwordHash: string;
  }): Promise<UserRecord> {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
      },
    });

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
    };
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

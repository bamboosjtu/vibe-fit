import { prisma } from "../db/prisma.js";
import type {
  BackupRecord,
  BackupRepository,
  EmailVerificationCodeRecord,
  EmailVerificationCodeRepository,
  Repositories,
  UserRecord,
  UserRepository,
} from "./types.js";

function toUserRecord(user: {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}): UserRecord {
  return {
    id: user.id,
    email: user.email,
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

    return toUserRecord(user);
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) return null;

    return toUserRecord(user);
  }

  async create(input: {
    email: string;
    name?: string | null;
    avatarUrl?: string | null;
  }): Promise<UserRecord> {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name ?? null,
        avatarUrl: input.avatarUrl ?? null,
      },
    });

    return toUserRecord(user);
  }
}

class PostgresEmailVerificationCodeRepository
  implements EmailVerificationCodeRepository
{
  async create(input: {
    email: string;
    code: string;
    expiresAt: Date;
  }): Promise<EmailVerificationCodeRecord> {
    const record = await prisma.emailVerificationCode.create({
      data: {
        email: input.email,
        code: input.code,
        expiresAt: input.expiresAt,
      },
    });

    return {
      id: record.id,
      email: record.email,
      code: record.code,
      expiresAt: record.expiresAt,
      consumedAt: record.consumedAt,
      createdAt: record.createdAt,
    };
  }

  async findLatestByEmail(
    email: string,
  ): Promise<EmailVerificationCodeRecord | null> {
    const record = await prisma.emailVerificationCode.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
    });

    if (!record) return null;

    return {
      id: record.id,
      email: record.email,
      code: record.code,
      expiresAt: record.expiresAt,
      consumedAt: record.consumedAt,
      createdAt: record.createdAt,
    };
  }

  async markConsumed(id: string): Promise<void> {
    await prisma.emailVerificationCode.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
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
  verificationCodes: new PostgresEmailVerificationCodeRepository(),
  backups: new PostgresBackupRepository(),
};

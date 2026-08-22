import type { FastifyInstance } from "fastify";
import { badRequest, unauthorized } from "../plugins/errorHandler.js";
import { repositories } from "../repositories/index.js";
import { eventPublisher } from "../events/index.js";
import { randomUUID } from "crypto";
import { BackupPayloadSchema, type BackupPayload } from "../schemas/backup.js";

export default async function syncRoutes(fastify: FastifyInstance) {
  // Endpoints requested by m2 checklist
  fastify.post<{ Body: BackupPayload }>(
    "/api/backups",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      return handlePush(request, reply);
    },
  );

  fastify.get(
    "/api/backups/latest",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      return handlePull(request, reply);
    },
  );

  async function handlePush(request: any, reply: any) {
    const user = request.user;
    const parsed = BackupPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("备份数据格式无效", parsed.error.flatten());
    }
    // Validation must not normalize or add defaults: successful push/pull responses
    // remain byte-for-byte compatible at the JSON value level.
    const body = request.body as BackupPayload;

    const dbUser = await repositories.users.findById(user.id);

    if (!dbUser) {
      throw unauthorized("User not found");
    }

    const backup = await repositories.backups.create({
      userId: user.id,
      deviceId: body.deviceId,
      payload: body,
    });

    let eventPublished = true;

    try {
      await eventPublisher.publishBackupCreated({
        eventType: "backup.created",
        eventVersion: 1,
        eventId: randomUUID(),
        occurredAt: new Date().toISOString(),
        userId: user.id,
        backupId: backup.id,
        deviceId: body.deviceId ?? null,
      });
    } catch (err) {
      eventPublished = false;

      request.log.error(
        {
          err,
          backupId: backup.id,
          userId: user.id,
        },
        "Failed to publish backup.created",
      );
    }

    return reply.status(200).send({
      success: true,
      backupId: backup.id,
      syncedAt: backup.createdAt,
      eventPublished,
      message: "Data synced successfully",
    });
  }

  async function handlePull(request: any, reply: any) {
    const user = request.user;

    const backup = await repositories.backups.getLatestByUserId(user.id);

    if (!backup) {
      return reply.status(200).send({
        success: true,
        data: null,
        syncedAt: null,
      });
    }

    return reply.status(200).send({
      success: true,
      data: backup.payload,
      syncedAt: backup.createdAt,
    });
  }
}

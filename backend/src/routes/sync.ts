import type { FastifyInstance } from "fastify";
import { badRequest } from "../plugins/errorHandler.js";
import { repositories } from "../repositories/index.js";

interface PushBody {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  deviceId?: string;
  settings?: any;
  plans?: any[];
  sessions?: any[];
  exercises?: any[];
}

export default async function syncRoutes(fastify: FastifyInstance) {
  // Endpoints requested by m2 checklist
  fastify.post<{ Body: PushBody }>(
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
    const body = request.body;

    if (!body.schemaVersion || !body.exportedAt || !body.appVersion) {
      throw badRequest(
        "Missing required fields: schemaVersion, exportedAt, appVersion",
      );
    }

    const backup = await repositories.backups.create({
      userId: user.id,
      deviceId: body.deviceId,
      payload: body,
    });

    return reply.status(200).send({
      success: true,
      backupId: backup.id,
      syncedAt: backup.createdAt,
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

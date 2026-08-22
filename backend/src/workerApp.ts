import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "./config/env.js";
import { repositories } from "./repositories/index.js";

const PubSubPushBodySchema = z.object({
  message: z.object({
    data: z.string().min(1),
    messageId: z.string().optional(),
    publishTime: z.string().optional(),
    attributes: z.record(z.string(), z.string()).optional(),
  }),
  subscription: z.string().optional(),
});

const BackupCreatedEventSchema = z.object({
  eventType: z.literal("backup.created"),
  eventVersion: z.literal(1),
  eventId: z.string().uuid(),
  occurredAt: z.string().datetime({ offset: true }),
  userId: z.string().uuid(),
  backupId: z.string().uuid(),
  deviceId: z.string().nullable().optional(),
});

export async function buildWorker(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: env.isTest()
      ? false
      : {
          level: env.isDev() ? "debug" : "info",
          transport: env.LOG_PRETTY
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
        },
  });

  fastify.get("/health", async () => {
    if (env.DATA_MODE === "postgres") {
      await repositories.users.findById("00000000-0000-0000-0000-000000000000");
    }
    return {
      status: "ok",
      service: "vibe-fit-worker",
      environment: env.NODE_ENV,
      releaseVersion: env.APP_VERSION,
      gitRevision: env.GIT_REVISION,
    };
  });

  fastify.post("/pubsub/backups", async (request, reply) => {
    const bodyResult = PubSubPushBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      request.log.warn({ issues: bodyResult.error.flatten() }, "Invalid Pub/Sub push body");
      return reply.status(400).send({ success: false, message: "Invalid Pub/Sub push body" });
    }

    let parsed: unknown;
    try {
      const decoded = Buffer.from(bodyResult.data.message.data, "base64").toString("utf8");
      parsed = JSON.parse(decoded);
    } catch (error) {
      request.log.warn({ error }, "Invalid Pub/Sub message data");
      return reply.status(400).send({ success: false, message: "Invalid Pub/Sub message data" });
    }

    const eventResult = BackupCreatedEventSchema.safeParse(parsed);
    if (!eventResult.success) {
      request.log.warn({ issues: eventResult.error.flatten() }, "Invalid backup.created event");
      return reply.status(400).send({ success: false, message: "Invalid backup.created event" });
    }

    const event = eventResult.data;
    const olderThan = new Date(Date.now() - env.BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const deletedSnapshots = await repositories.backups.pruneExpiredByUserId(event.userId, {
      olderThan,
      minToKeep: env.BACKUP_MIN_SNAPSHOTS,
    });

    request.log.info(
      {
        eventId: event.eventId,
        backupId: event.backupId,
        userId: event.userId,
        deviceId: event.deviceId,
        messageId: bodyResult.data.message.messageId,
        subscription: bodyResult.data.subscription,
        deletedSnapshots,
      },
      "Processed backup.created event",
    );

    return reply.status(204).send();
  });

  return fastify;
}

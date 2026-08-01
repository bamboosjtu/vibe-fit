import Fastify from "fastify";
import { z } from "zod";
import { env } from "./config/env.js";

const fastify = Fastify({
  logger: {
    level: env.isDev() ? "debug" : "info",
    transport: env.LOG_PRETTY
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
          },
        }
      : undefined,
  },
});

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
  occurredAt: z.string(),
  userId: z.string().uuid(),
  backupId: z.string().uuid(),
  deviceId: z.string().nullable().optional(),
});

fastify.get("/health", async () => {
  return {
    status: "ok",
    service: "vibe-fit-worker",
    environment: env.NODE_ENV,
  };
});

fastify.post("/pubsub/backups", async (request, reply) => {
  const bodyResult = PubSubPushBodySchema.safeParse(request.body);

  if (!bodyResult.success) {
    request.log.warn(
      {
        issues: bodyResult.error.flatten(),
      },
      "Invalid Pub/Sub push body",
    );

    return reply.status(400).send({
      success: false,
      message: "Invalid Pub/Sub push body",
    });
  }

  let decoded: string;

  try {
    decoded = Buffer.from(bodyResult.data.message.data, "base64").toString(
      "utf8",
    );
  } catch (err) {
    request.log.warn({ err }, "Failed to decode Pub/Sub message data");

    return reply.status(400).send({
      success: false,
      message: "Invalid Pub/Sub message data",
    });
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(decoded);
  } catch (err) {
    request.log.warn({ err, decoded }, "Failed to parse Pub/Sub event JSON");

    return reply.status(400).send({
      success: false,
      message: "Invalid event JSON",
    });
  }

  const eventResult = BackupCreatedEventSchema.safeParse(parsed);

  if (!eventResult.success) {
    request.log.warn(
      {
        issues: eventResult.error.flatten(),
        parsed,
      },
      "Invalid backup.created event",
    );

    return reply.status(400).send({
      success: false,
      message: "Invalid backup.created event",
    });
  }

  const event = eventResult.data;

  request.log.info(
    {
      eventId: event.eventId,
      backupId: event.backupId,
      userId: event.userId,
      deviceId: event.deviceId,
      messageId: bodyResult.data.message.messageId,
      subscription: bodyResult.data.subscription,
    },
    "Processed backup.created event",
  );

  return reply.status(204).send();
});

async function start() {
  try {
    const address = await fastify.listen({
      port: env.PORT,
      host: "0.0.0.0",
    });

    fastify.log.info(`Worker listening at ${address}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();

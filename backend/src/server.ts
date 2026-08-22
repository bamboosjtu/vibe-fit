import { buildServer } from "./app.js";
import { env } from "./config/env.js";
import { closeDatabase } from "./db/prisma.js";

const fastify = await buildServer();
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  fastify.log.info({ signal }, "Graceful shutdown started");

  try {
    await fastify.close();
    await closeDatabase();
    fastify.log.info("Graceful shutdown complete");
    process.exitCode = 0;
  } catch (error) {
    fastify.log.error({ error }, "Graceful shutdown failed");
    process.exitCode = 1;
  }
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

try {
  const address = await fastify.listen({
    port: env.PORT,
    host: "0.0.0.0",
  });
  fastify.log.info({ address, environment: env.NODE_ENV }, "Server listening");
} catch (error) {
  fastify.log.error(error);
  await closeDatabase();
  process.exitCode = 1;
}

import { buildWorker } from "./workerApp.js";
import { env } from "./config/env.js";
import { closeDatabase } from "./db/prisma.js";

const fastify = await buildWorker();
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  fastify.log.info({ signal }, "Worker graceful shutdown started");

  try {
    await fastify.close();
    await closeDatabase();
    fastify.log.info("Worker graceful shutdown complete");
    process.exitCode = 0;
  } catch (error) {
    fastify.log.error({ error }, "Worker graceful shutdown failed");
    process.exitCode = 1;
  }
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

try {
  const address = await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
  fastify.log.info({ address }, "Worker listening");
} catch (error) {
  fastify.log.error(error);
  await closeDatabase();
  process.exitCode = 1;
}

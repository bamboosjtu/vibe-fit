import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import { env } from "./config/env.js";
import errorHandlerPlugin from "./plugins/errorHandler.js";
import healthzRoutes from "./routes/healthz.js";
import syncRoutes from "./routes/sync.js";
import authRoutes from "./routes/auth.js";

declare module "fastify" {
  export interface FastifyInstance {
    authenticate: (request: unknown, reply: unknown) => Promise<void>;
  }
}

function getCorsOrigin(): true | false | string | string[] {
  if (env.isDev() || env.isTest()) return true;
  if (!env.CORS_ORIGIN) return false;

  const origins = env.CORS_ORIGIN
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) return false;
  if (origins.includes("*")) {
    throw new Error("CORS_ORIGIN must not contain a wildcard in production");
  }
  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGIN contains an invalid origin: ${origin}`);
    }
    if (parsed.protocol !== "https:" || parsed.origin !== origin) {
      throw new Error(`CORS_ORIGIN must contain HTTPS origins only: ${origin}`);
    }
  }
  return origins.length === 1 ? origins[0] : origins;
}

export async function buildServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    bodyLimit: env.MAX_BACKUP_BYTES,
    trustProxy: true,
    logger: env.isTest()
      ? false
      : {
          level: env.isDev() ? "debug" : "info",
          transport: env.LOG_PRETTY
            ? {
                target: "pino-pretty",
                options: { colorize: true },
              }
            : undefined,
        },
  });

  await fastify.register(cors, {
    origin: getCorsOrigin(),
    credentials: true,
  });

  await fastify.register(fastifyJwt, { secret: env.JWT_SECRET });
  fastify.decorate("authenticate", async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (error) {
      await reply.send(error);
    }
  });

  await fastify.register(errorHandlerPlugin);
  await fastify.register(healthzRoutes);
  await fastify.register(authRoutes);
  await fastify.register(syncRoutes);

  return fastify;
}

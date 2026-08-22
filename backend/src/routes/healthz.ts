import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env.js";
import { repositories } from "../repositories/index.js";
import { getDatabaseSchemaVersion } from "../db/prisma.js";

export default async function healthzRoutes(fastify: FastifyInstance) {
  // 给负载均衡 / 反向代理 / 简单健康检查使用
  fastify.get(
    "/health",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        status: "ok",
      });
    },
  );

  // 给人工排查使用
  fastify.get(
    "/healthz",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        status: "ok",
        timestamp: new Date().toISOString(),
        version: env.APP_VERSION,
        gitRevision: env.GIT_REVISION,
        environment: env.NODE_ENV,
      });
    },
  );

  // 给前端展示版本或调试连接使用
  fastify.get(
    "/api/version",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const databaseSchemaVersion = await getDatabaseSchemaVersion();
      return reply.send({
        name: "vibe-fit-backend",
        version: env.APP_VERSION,
        releaseVersion: env.APP_VERSION,
        gitRevision: env.GIT_REVISION,
        databaseSchemaVersion,
        environment: env.NODE_ENV,
        authMode: env.AUTH_MODE,
        dataMode: env.DATA_MODE,
      });
    },
  );

  fastify.get(
    "/readyz",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (env.DATA_MODE === "postgres") {
          await repositories.users.findById(
            "00000000-0000-0000-0000-000000000000",
          );
        }

        return reply.send({
          status: "ready",
          timestamp: new Date().toISOString(),
          environment: env.NODE_ENV,
          dataMode: env.DATA_MODE,
        });
      } catch (err) {
        request.log.error({ err }, "Readiness check failed");

        return reply.status(503).send({
          status: "not_ready",
          timestamp: new Date().toISOString(),
          environment: env.NODE_ENV,
          dataMode: env.DATA_MODE,
        });
      }
    },
  );
}

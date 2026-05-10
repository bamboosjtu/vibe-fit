import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';

const VERSION = '1.0.0';

export default async function healthzRoutes(fastify: FastifyInstance) {
  // 给 Cloud Run / 负载均衡 / 简单健康检查使用
  fastify.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
    });
  });

  // 给人工排查使用
  fastify.get('/healthz', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: VERSION,
      environment: env.NODE_ENV,
    });
  });

  // 给前端展示版本或调试连接使用
  fastify.get('/api/version', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      name: 'vibe-fit-backend',
      version: VERSION,
      environment: env.NODE_ENV,
      authMode: env.AUTH_MODE,
      dataMode: env.DATA_MODE,
    });
  });
}
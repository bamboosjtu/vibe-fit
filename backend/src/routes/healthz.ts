import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const VERSION = '1.0.0';

export default async function healthzRoutes(fastify: FastifyInstance) {
  // Provided for load balancers and simple health checks
  fastify.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ status: 'ok' });
  });

  // Detailed health check (optional, kept for backwards compatibility)
  fastify.get('/healthz', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: VERSION,
    });
  });

  // Version endpoint requested by m2 checklist
  fastify.get('/api/version', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      version: VERSION,
      environment: process.env.NODE_ENV || 'development'
    });
  });
}


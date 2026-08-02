import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import { env } from './config/env.js';
import errorHandlerPlugin from './plugins/errorHandler.js';
import healthzRoutes from './routes/healthz.js';
import syncRoutes from './routes/sync.js';
import authRoutes from './routes/auth.js';

const fastify = Fastify({
  // 信任反向代理（Caddy / nginx / ALB）转发的 X-Forwarded-* 头，
  // 使 request.protocol 和 request.ip 反映真实客户端信息
  trustProxy: true,
  logger: {
    level: env.isDev() ? 'debug' : 'info',
    transport: env.LOG_PRETTY
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        }
      : undefined,
  },
});

declare module 'fastify' {
  export interface FastifyInstance {
    authenticate: any;
  }
}

async function start() {
  try {
    const corsOrigin = (() => {
      if (env.isDev()) return true;
      if (env.CORS_ORIGIN) {
        const origins = env.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean);
        if (origins.length === 1) return origins[0];
        if (origins.length > 1) return origins;
      }
      // For M2 local Docker testing, allow localhost:8080 by default
      return ['http://localhost:8080', 'http://127.0.0.1:8080'];
    })();

    await fastify.register(cors, {
      origin: corsOrigin,
      credentials: true,
    });

    await fastify.register(fastifyJwt, {
      secret: env.JWT_SECRET,
    });

    fastify.decorate('authenticate', async function (request: any, reply: any) {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.send(err);
      }
    });

    await fastify.register(errorHandlerPlugin);
    await fastify.register(healthzRoutes); // mounted at root to provide /health and /api/version
    await fastify.register(authRoutes); // mounted at root to provide /api/auth/send-code, /api/auth/verify-code and /api/me
    await fastify.register(syncRoutes); // mounted at root to provide /api/backups

    const address = await fastify.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });

    fastify.log.info(`Server listening at ${address}`);
    fastify.log.info(`Environment: ${env.NODE_ENV}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { badRequest, unauthorized } from '../plugins/errorHandler.js';
import { mockDb } from '../mockDb.js';
import { env } from '../config/env.js';

const AuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default async function authRoutes(fastify: FastifyInstance) {
  const mockAuthHandler = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const result = AuthSchema.safeParse(request.body);

    if (!result.success) {
      throw badRequest('Invalid email or password', result.error.flatten());
    }

    const { email, password } = result.data;

    let user = mockDb.users.find((u) => u.email === email);

    // m2 阶段：mock 模式下自动注册用户，方便前后端联调。
    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 10);

      user = {
        id: randomUUID(),
        email,
        passwordHash: hashedPassword,
      };

      mockDb.users.push(user);
    } else {
      const isMatch = await bcrypt.compare(password, user.passwordHash);

      if (!isMatch) {
        throw unauthorized('Invalid credentials');
      }
    }

    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
    });

    return reply.status(200).send({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  };

  const unsupportedAuthHandler = async () => {
    throw badRequest(
      'Current AUTH_MODE is not mock. Google auth will be implemented in a later milestone.'
    );
  };

  if (env.AUTH_MODE === 'mock') {
    // m2 阶段给前端使用的 mock 登录/注册。
    fastify.post('/api/auth/register', mockAuthHandler);
    fastify.post('/api/auth/login', mockAuthHandler);

    // /dev/login 只在 development 环境开放。
    // 如果部署到 Cloud Run 做 dev 测试，需要设置 NODE_ENV=development。
    if (env.isDev()) {
      fastify.post('/dev/login', mockAuthHandler);
    }
  } else {
    fastify.post('/api/auth/register', unsupportedAuthHandler);
    fastify.post('/api/auth/login', unsupportedAuthHandler);
  }

  fastify.get(
    '/api/me',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const tokenUser = (request as any).user;

      const dbUser = mockDb.users.find((u) => u.id === tokenUser.id);

      if (!dbUser) {
        throw unauthorized('User not found');
      }

      return reply.send({
        user: {
          id: dbUser.id,
          email: dbUser.email,
        },
      });
    }
  );
}
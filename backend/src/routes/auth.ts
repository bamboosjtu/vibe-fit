import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { badRequest, unauthorized } from '../plugins/errorHandler.js';
import { mockDb } from '../mockDb.js';

const AuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default async function authRoutes(fastify: FastifyInstance) {
  const permissiveHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const result = AuthSchema.safeParse(request.body);
    if (!result.success) {
      throw badRequest('Invalid email or password');
    }

    const { email, password } = result.data;

    let user = mockDb.users.find(u => u.email === email);
    
    // Dev login/register: Auto-create user if not exists to simplify testing
    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = {
        id: randomUUID(),
        email,
        passwordHash: hashedPassword,
      };
      mockDb.users.push(user);
    } else {
      // If user exists, check password
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        throw unauthorized('Invalid credentials for existing user');
      }
    }

    const token = fastify.jwt.sign({ id: user.id, email: user.email });

    return reply.status(200).send({
      success: true,
      token,
      user: { id: user.id, email: user.email },
    });
  };

  // In M2 stage/Dev mode, all these endpoints use the same permissive logic
  fastify.post('/api/auth/register', permissiveHandler);
  fastify.post('/api/auth/login', permissiveHandler);
  fastify.post('/dev/login', permissiveHandler);

  fastify.get('/api/me', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user;
    
    // In a real app, you'd fetch fresh data from the DB
    const dbUser = mockDb.users.find(u => u.id === user.id);
    if (!dbUser) {
      throw unauthorized('User not found');
    }

    return reply.send({
      id: dbUser.id,
      email: dbUser.email,
    });
  });
}


import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { badRequest, unauthorized } from "../plugins/errorHandler.js";
import { env } from "../config/env.js";
import { repositories } from "../repositories/index.js";
import { OAuth2Client } from "google-auth-library";

const AuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const GoogleAuthSchema = z.object({
  idToken: z.string().min(1),
});

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export default async function authRoutes(fastify: FastifyInstance) {
  const mockAuthHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const result = AuthSchema.safeParse(request.body);

    if (!result.success) {
      throw badRequest("Invalid email or password", result.error.flatten());
    }

    const { email, password } = result.data;

    let user = await repositories.users.findByEmail(email);
    
    // m2 阶段：mock 模式下自动注册用户，方便前后端联调。
    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 10);

      user = await repositories.users.create({
        email,
        passwordHash: hashedPassword,
      });
    } else {
      if (!user.passwordHash) {
        throw unauthorized("This account uses Google sign-in");
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);

      if (!isMatch) {
        throw unauthorized("Invalid credentials");
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

  const googleAuthHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const result = GoogleAuthSchema.safeParse(request.body);

    if (!result.success) {
      throw badRequest("Invalid Google auth payload", result.error.flatten());
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: result.data.idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email) {
      throw unauthorized("Invalid Google token");
    }

    const user = await repositories.users.upsertGoogleUser({
      email: payload.email,
      providerUserId: payload.sub,
      name: payload.name ?? null,
      avatarUrl: payload.picture ?? null,
    });

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
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  };

  if (env.AUTH_MODE === "mock") {
    // m2 阶段给前端使用的 mock 登录/注册。
    fastify.post("/api/auth/register", mockAuthHandler);
    fastify.post("/api/auth/login", mockAuthHandler);

    // /dev/login 只在 development 环境开放。
    // 如果部署到 Cloud Run 做 dev 测试，需要设置 NODE_ENV=development。
    if (env.isDev()) {
      fastify.post("/dev/login", mockAuthHandler);
    }
  }

  if (env.AUTH_MODE === "google") {
    fastify.post("/api/auth/google", googleAuthHandler);
  }

  fastify.get(
    "/api/me",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const tokenUser = (request as any).user;

      const dbUser = await repositories.users.findById(tokenUser.id);

      if (!dbUser) {
        throw unauthorized("User not found");
      }

      return reply.send({
        user: {
          id: dbUser.id,
          email: dbUser.email,
        },
      });
    },
  );
}

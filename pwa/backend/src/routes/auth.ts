import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { badRequest, unauthorized } from "../plugins/errorHandler.js";
import { env } from "../config/env.js";
import { repositories } from "../repositories/index.js";
import { sendVerificationEmail } from "../services/emailService.js";

const SendCodeSchema = z.object({
  email: z.string().email(),
});

const VerifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(env.VERIFY_CODE_LENGTH),
});

function generateCode(length: number): string {
  const digits = "0123456789";
  let code = "";

  for (let i = 0; i < length; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }

  return code;
}

export default async function authRoutes(fastify: FastifyInstance) {
  // 第一步：发送验证码
  fastify.post("/api/auth/send-code", async (request, reply) => {
    const result = SendCodeSchema.safeParse(request.body);

    if (!result.success) {
      throw badRequest("邮箱格式不正确", result.error.flatten());
    }

    const { email } = result.data;

    // 生成验证码并写入仓储
    const code = generateCode(env.VERIFY_CODE_LENGTH);
    const expiresAt = new Date(
      Date.now() + env.VERIFY_CODE_TTL_SECONDS * 1000,
    );

    await repositories.verificationCodes.create({ email, code, expiresAt });

    if (env.AUTH_MODE === "mock") {
      // 测试模式：不发送邮件，验证码直接返回（便于测试读取）
      request.log.info({ email, code }, "Mock verify code generated");

      return reply.status(200).send({
        success: true,
        devCode: code,
        message: "测试模式：验证码已返回，未发送邮件",
      });
    }

    // email 模式：通过 SMTP 发送
    if (!env.isSmtpConfigured()) {
      request.log.error({ email }, "SMTP not configured");
      throw badRequest(
        "邮件服务未配置，请在 .env / docker-compose.yml 中填写 SMTP_HOST、SMTP_USER、SMTP_PASS",
      );
    }

    try {
      await sendVerificationEmail(email, code);
    } catch (err) {
      request.log.error({ err, email }, "Failed to send verification email");
      throw badRequest("验证码邮件发送失败，请稍后重试");
    }

    return reply.status(200).send({
      success: true,
      message: "验证码已发送，请查收邮件",
    });
  });

  // 第二步：校验验证码并登录/注册
  fastify.post("/api/auth/verify-code", async (request, reply) => {
    const result = VerifyCodeSchema.safeParse(request.body);

    if (!result.success) {
      throw badRequest("请求参数不正确", result.error.flatten());
    }

    const { email, code } = result.data;

    const record =
      await repositories.verificationCodes.findLatestByEmail(email);

    if (!record || record.consumedAt) {
      throw unauthorized("验证码不存在或已使用，请重新获取");
    }

    if (record.code !== code) {
      throw unauthorized("验证码错误");
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw unauthorized("验证码已过期，请重新获取");
    }

    // 标记验证码已使用
    await repositories.verificationCodes.markConsumed(record.id);

    // 查找或创建用户（验证码即注册）
    let user = await repositories.users.findByEmail(email);

    if (!user) {
      user = await repositories.users.create({ email });
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
  });

  fastify.get(
    "/api/me",
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
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

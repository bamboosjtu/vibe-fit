import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return transporter;
}

export async function sendVerificationEmail(
  email: string,
  code: string,
): Promise<void> {
  const from =
    env.SMTP_FROM || env.SMTP_USER || "VibeFit <no-reply@vibefit.local>";

  const transport = getTransporter();

  await transport.sendMail({
    from,
    to: email,
    subject: "【VibeFit】登录验证码",
    text: `您的 VibeFit 登录验证码是：${code}\n\n验证码 5 分钟内有效，请勿泄露给他人。如非本人操作，请忽略本邮件。`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #10B981;">VibeFit 登录验证码</h2>
        <p>您的登录验证码是：</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #10B981; background: #f0fdf4; padding: 16px; border-radius: 12px; text-align: center;">${code}</p>
        <p style="color: #6b7280; font-size: 14px;">验证码 5 分钟内有效，请勿泄露给他人。如非本人操作，请忽略本邮件。</p>
      </div>
    `,
  });
}

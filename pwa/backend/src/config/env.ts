import dotenv from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

// 认证模式：
//   - email：邮箱验证码登录（默认，本地部署）
//   - mock ：仅用于测试，跳过邮件发送，验证码直接返回
type AuthMode = "mock" | "email";
// 数据模式：
//   - postgres：PostgreSQL（默认，本地 Docker）
//   - mock    ：内存数据，仅用于测试
type DataMode = "mock" | "postgres";
// 事件发布模式：
//   - local：本地 HTTP push 到 worker（默认，本地 Docker）
//   - mock ：仅日志输出，仅用于测试
type EventPublisherMode = "mock" | "local";

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;

  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function getOptionalEnv(key: string, defaultValue = ""): string {
  return process.env[key] ?? defaultValue;
}

function getMode<T extends string>(
  key: string,
  allowedValues: readonly T[],
  defaultValue: T,
): T {
  const value = getOptionalEnv(key, defaultValue);

  if (!allowedValues.includes(value as T)) {
    throw new Error(
      `Invalid ${key}: ${value}. Allowed values: ${allowedValues.join(", ")}`,
    );
  }

  return value as T;
}

const NODE_ENV = getOptionalEnv("NODE_ENV", "development");
const isProduction = NODE_ENV === "production";

const AUTH_MODE = getMode<AuthMode>("AUTH_MODE", ["mock", "email"], "email");
const DATA_MODE = getMode<DataMode>("DATA_MODE", ["mock", "postgres"], "postgres");
const EVENT_PUBLISHER = getMode<EventPublisherMode>(
  "EVENT_PUBLISHER",
  ["mock", "local"],
  "local",
);

const PORT = Number.parseInt(getOptionalEnv("PORT", "8080"), 10);

if (Number.isNaN(PORT)) {
  throw new Error("Invalid PORT: must be a number");
}

const DATABASE_URL =
  DATA_MODE === "postgres"
    ? getEnv("DATABASE_URL")
    : getOptionalEnv("DATABASE_URL", "");

// email 模式下需要 SMTP 配置（163 邮箱）。本地部署时这些值留空由用户填写，
// 仅在 AUTH_MODE=email 且 NODE_ENV!=test 时才校验非空。
const SMTP_HOST = getOptionalEnv("SMTP_HOST", "");
const SMTP_PORT = Number.parseInt(getOptionalEnv("SMTP_PORT", "465"), 10);
const SMTP_USER = getOptionalEnv("SMTP_USER", "");
const SMTP_PASS = getOptionalEnv("SMTP_PASS", "");
const SMTP_FROM = getOptionalEnv("SMTP_FROM", "");

// 本地事件发布：worker 的 HTTP push 端点（Docker 网络内 http://worker:8080）
const WORKER_PUSH_URL = getOptionalEnv(
  "WORKER_PUSH_URL",
  "http://worker:8080/pubsub/backups",
);

// 验证码配置
const VERIFY_CODE_TTL_SECONDS = Number.parseInt(
  getOptionalEnv("VERIFY_CODE_TTL_SECONDS", "300"),
  10,
);
const VERIFY_CODE_LENGTH = Number.parseInt(
  getOptionalEnv("VERIFY_CODE_LENGTH", "6"),
  10,
);

export const env = {
  PORT,
  NODE_ENV,

  AUTH_MODE,
  DATA_MODE,
  EVENT_PUBLISHER,

  CORS_ORIGIN: getOptionalEnv("CORS_ORIGIN", ""),

  LOG_PRETTY: getOptionalEnv("LOG_PRETTY", "false") === "true",

  DATABASE_URL,

  // SMTP（163 邮箱）。本地部署时由用户在 .env / docker-compose.yml 中填写。
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,

  // 本地事件推送
  WORKER_PUSH_URL,

  // 验证码
  VERIFY_CODE_TTL_SECONDS,
  VERIFY_CODE_LENGTH,

  JWT_SECRET: isProduction
    ? getEnv("JWT_SECRET")
    : getEnv("JWT_SECRET", "dev-only-secret"),

  isDev(): boolean {
    return this.NODE_ENV === "development";
  },

  isProd(): boolean {
    return this.NODE_ENV === "production";
  },

  isTest(): boolean {
    return this.NODE_ENV === "test";
  },

  // email 模式下、且非测试环境，必须有完整 SMTP 配置
  isSmtpConfigured(): boolean {
    return Boolean(this.SMTP_HOST && this.SMTP_USER && this.SMTP_PASS);
  },
};

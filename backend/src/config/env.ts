import dotenv from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

type AuthMode = "mock" | "google";
type DataMode = "mock" | "postgres";
type EventPublisherMode = "mock" | "pubsub";

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

const AUTH_MODE = getMode<AuthMode>("AUTH_MODE", ["mock", "google"], "mock");
const DATA_MODE = getMode<DataMode>("DATA_MODE", ["mock", "postgres"], "mock");
const EVENT_PUBLISHER = getMode<EventPublisherMode>(
  "EVENT_PUBLISHER",
  ["mock", "pubsub"],
  "mock",
);

const PORT = Number.parseInt(getOptionalEnv("PORT", "8080"), 10);

if (Number.isNaN(PORT)) {
  throw new Error("Invalid PORT: must be a number");
}

const DATABASE_URL =
  DATA_MODE === "postgres"
    ? getEnv("DATABASE_URL")
    : getOptionalEnv("DATABASE_URL", "");

const GOOGLE_CLIENT_ID =
  AUTH_MODE === "google"
    ? getEnv("GOOGLE_CLIENT_ID")
    : getOptionalEnv("GOOGLE_CLIENT_ID", "");

const PUBSUB_TOPIC_BACKUP_CREATED =
  EVENT_PUBLISHER === "pubsub"
    ? getEnv("PUBSUB_TOPIC_BACKUP_CREATED")
    : getOptionalEnv("PUBSUB_TOPIC_BACKUP_CREATED", "");

export const env = {
  PORT,
  NODE_ENV,

  AUTH_MODE,
  DATA_MODE,
  EVENT_PUBLISHER,

  CORS_ORIGIN: getOptionalEnv("CORS_ORIGIN", ""),

  LOG_PRETTY: getOptionalEnv("LOG_PRETTY", "false") === "true",

  DATABASE_URL,
  GOOGLE_CLIENT_ID,
  PUBSUB_TOPIC_BACKUP_CREATED,

  JWT_SECRET: isProduction
    ? getEnv("JWT_SECRET")
    : getEnv("JWT_SECRET", "dev-only-secret"),

  isDev(): boolean {
    return this.NODE_ENV === "development";
  },

  isProd(): boolean {
    return this.NODE_ENV === "production";
  },
};

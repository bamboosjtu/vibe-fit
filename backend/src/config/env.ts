import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  PORT: parseInt(getEnv('PORT', '3000'), 10),
  NODE_ENV: getEnv('NODE_ENV', 'development'),
  CORS_ORIGIN: getEnv('CORS_ORIGIN', ''),
  JWT_SECRET: getEnv('JWT_SECRET', 'super_secret_jwt_key_vibefit_2026'),
  DATABASE_URL: getEnv('DATABASE_URL', 'postgresql://vibefit:vibefitpassword@localhost:5432/vibefit?schema=public'),
  isDev(): boolean {
    return this.NODE_ENV === 'development';
  },
  isProd(): boolean {
    return this.NODE_ENV === 'production';
  },
};

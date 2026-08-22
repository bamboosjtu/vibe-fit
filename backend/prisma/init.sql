-- VibeFit Backend Schema (v1)
-- MVP 期间每次测试使用全新 postgres 环境直接执行此脚本，无需 migration 追踪。
-- 正式发布后再从 prisma migrate dev 建立迁移基线。

CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

CREATE TABLE IF NOT EXISTS "email_verification_codes" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "email_verification_codes_email_created_at_idx" ON "email_verification_codes"("email", "created_at");

CREATE TABLE IF NOT EXISTS "backup_snapshots" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "backup_snapshots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "backup_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "backup_snapshots_user_id_created_at_idx" ON "backup_snapshots"("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "sync_meta" (
    "user_id" UUID NOT NULL,
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "last_sync_status" TEXT NOT NULL,
    CONSTRAINT "sync_meta_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "sync_meta_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

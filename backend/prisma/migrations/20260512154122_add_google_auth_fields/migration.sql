/*
  Warnings:

  - A unique constraint covering the columns `[provider,provider_user_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'mock',
ADD COLUMN     "provider_user_id" TEXT,
ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_provider_provider_user_id_key" ON "users"("provider", "provider_user_id");

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncMeta" (
    "userId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncStatus" TEXT NOT NULL,

    CONSTRAINT "SyncMeta_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "BackupSnapshot_userId_createdAt_idx" ON "BackupSnapshot"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "BackupSnapshot" ADD CONSTRAINT "BackupSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncMeta" ADD CONSTRAINT "SyncMeta_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

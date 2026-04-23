ALTER TABLE "ServerCheck"
ADD COLUMN "trigger" TEXT NOT NULL DEFAULT 'worker',
ADD COLUMN "bucketType" TEXT NOT NULL DEFAULT 'interval';

CREATE INDEX "ServerCheck_serverId_bucketType_createdAt_idx"
ON "ServerCheck"("serverId", "bucketType", "createdAt");

CREATE INDEX "ServerCheck_serverId_trigger_createdAt_idx"
ON "ServerCheck"("serverId", "trigger", "createdAt");

-- AlterTable
ALTER TABLE "JobRun" ALTER COLUMN "trigger" SET DEFAULT 'worker';

-- AlterTable
ALTER TABLE "Server" ALTER COLUMN "loadAvg" SET DEFAULT '0.00, 0.00, 0.00';

-- AlterTable
ALTER TABLE "ServerCheck" ALTER COLUMN "trigger" SET DEFAULT 'scheduled';

-- AlterTable
ALTER TABLE "SiteCheck" ADD COLUMN     "trigger" TEXT NOT NULL DEFAULT 'scheduled';

-- CreateIndex
CREATE INDEX "Site_serverId_idx" ON "Site"("serverId");

-- CreateIndex
CREATE INDEX "Site_cfAccountId_idx" ON "Site"("cfAccountId");

-- CreateIndex
CREATE INDEX "SiteCheck_siteId_createdAt_idx" ON "SiteCheck"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteCheck_siteId_trigger_createdAt_idx" ON "SiteCheck"("siteId", "trigger", "createdAt");

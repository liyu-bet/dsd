-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "unlinkedFromServerAt" TIMESTAMP(3),
ADD COLUMN     "scheduledDeletionAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Site_scheduledDeletionAt_idx" ON "Site"("scheduledDeletionAt");

-- AlterTable
ALTER TABLE "Site"
  ADD COLUMN IF NOT EXISTS "registrarAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "domainExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Site_registrarAccountId_idx" ON "Site"("registrarAccountId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Site_registrarAccountId_fkey'
  ) THEN
    ALTER TABLE "Site"
      ADD CONSTRAINT "Site_registrarAccountId_fkey"
      FOREIGN KEY ("registrarAccountId") REFERENCES "RegistrarAccount"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

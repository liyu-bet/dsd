ALTER TABLE "Server"
ADD COLUMN "hostingAccountId" TEXT;

CREATE INDEX "Server_hostingAccountId_idx" ON "Server"("hostingAccountId");

ALTER TABLE "Server"
ADD CONSTRAINT "Server_hostingAccountId_fkey"
FOREIGN KEY ("hostingAccountId") REFERENCES "HostingAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

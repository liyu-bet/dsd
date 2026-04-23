-- Inferno / billing sync fields on Server
ALTER TABLE "Server" ADD COLUMN "billingRenewalAt" TIMESTAMP(3);
ALTER TABLE "Server" ADD COLUMN "billingServiceId" TEXT;
ALTER TABLE "Server" ADD COLUMN "billingHasUnpaidOrder" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "publicDnsInfoJson" TEXT,
ADD COLUMN     "publicDnsInfoUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "whoisInfoJson" TEXT,
ADD COLUMN     "whoisInfoUpdatedAt" TIMESTAMP(3);

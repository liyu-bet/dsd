-- AlterTable
ALTER TABLE "Server"
ADD COLUMN     "password" TEXT,
ADD COLUMN     "panelType" TEXT DEFAULT 'none',
ADD COLUMN     "panelUrl" TEXT,
ADD COLUMN     "panelLogin" TEXT,
ADD COLUMN     "panelPassword" TEXT;

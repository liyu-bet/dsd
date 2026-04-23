/*
  Warnings:

  - A unique constraint covering the columns `[monitorToken]` on the table `Server` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Server" ADD COLUMN     "monitorToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Server_monitorToken_key" ON "Server"("monitorToken");

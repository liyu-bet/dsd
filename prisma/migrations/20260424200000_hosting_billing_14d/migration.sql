-- Сводка неоплаченных счетов (14 дн.) с последнего action=orders
ALTER TABLE "HostingAccount" ADD COLUMN "billingUnpaid14dCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HostingAccount" ADD COLUMN "billingUnpaid14dTotal" TEXT;

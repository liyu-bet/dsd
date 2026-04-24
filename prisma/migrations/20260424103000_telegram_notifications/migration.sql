CREATE TABLE "TelegramNotificationSetting" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "botToken" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Belgrade',
  "morningSummaryHour" INTEGER NOT NULL DEFAULT 9,
  "serverFailThreshold" INTEGER NOT NULL DEFAULT 2,
  "siteFailThreshold" INTEGER NOT NULL DEFAULT 3,
  "recoverySuccessCount" INTEGER NOT NULL DEFAULT 2,
  "domainRenewalDays" INTEGER NOT NULL DEFAULT 14,
  "lastMorningSummaryDate" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramNotificationSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramNotificationRecipient" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notifyDown" BOOLEAN NOT NULL DEFAULT true,
  "notifyUp" BOOLEAN NOT NULL DEFAULT true,
  "notifyDomain" BOOLEAN NOT NULL DEFAULT true,
  "notifyBilling" BOOLEAN NOT NULL DEFAULT true,
  "notifySummary" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramNotificationRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramNotificationEvent" (
  "id" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payloadJson" TEXT,
  "status" TEXT NOT NULL DEFAULT 'sent',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramNotificationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramNotificationEvent_eventKey_key" ON "TelegramNotificationEvent"("eventKey");

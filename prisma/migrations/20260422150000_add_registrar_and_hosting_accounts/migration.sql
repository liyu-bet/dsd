CREATE TABLE "RegistrarAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "login" TEXT NOT NULL,
    "password" TEXT,
    "apiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrarAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HostingAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "login" TEXT NOT NULL,
    "password" TEXT,
    "apiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HostingAccount_pkey" PRIMARY KEY ("id")
);

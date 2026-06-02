CREATE TABLE "CreditSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "usdToCnyRate" DOUBLE PRECISION NOT NULL DEFAULT 7.2,
    "creditsPerCny" INTEGER NOT NULL DEFAULT 10,
    "signupCredits" INTEGER NOT NULL DEFAULT 1500,
    "chargeText" BOOLEAN NOT NULL DEFAULT true,
    "chargeImage" BOOLEAN NOT NULL DEFAULT true,
    "chargeVideo" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "conversationTitle" TEXT,
    "requestId" TEXT,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "model" TEXT,
    "credits" INTEGER NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cny" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "videoCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CreditLedger_userId_createdAt_idx" ON "CreditLedger"("userId", "createdAt");
CREATE INDEX "CreditLedger_conversationId_idx" ON "CreditLedger"("conversationId");
CREATE UNIQUE INDEX "CreditLedger_requestId_kind_key" ON "CreditLedger"("requestId", "kind");

ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CreditSetting" ("id", "usdToCnyRate", "creditsPerCny", "signupCredits", "chargeText", "chargeImage", "chargeVideo", "updatedAt")
VALUES ('default', 7.2, 10, 1500, true, true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

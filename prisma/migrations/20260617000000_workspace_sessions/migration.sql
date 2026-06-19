CREATE TABLE "WorkspaceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "messagesJson" JSONB NOT NULL,
    "summaryJson" JSONB,
    "usageSummary" JSONB,
    "memorySummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceSession_userId_sessionId_key" ON "WorkspaceSession"("userId", "sessionId");
CREATE INDEX "WorkspaceSession_userId_updatedAt_idx" ON "WorkspaceSession"("userId", "updatedAt");

ALTER TABLE "WorkspaceSession" ADD CONSTRAINT "WorkspaceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

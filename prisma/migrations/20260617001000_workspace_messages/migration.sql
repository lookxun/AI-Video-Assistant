CREATE TABLE "WorkspaceMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "messageJson" JSONB NOT NULL,
    "storedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceMessage_userId_sessionId_messageId_key" ON "WorkspaceMessage"("userId", "sessionId", "messageId");
CREATE INDEX "WorkspaceMessage_userId_sessionId_createdAt_idx" ON "WorkspaceMessage"("userId", "sessionId", "createdAt");
CREATE INDEX "WorkspaceMessage_userId_createdAt_idx" ON "WorkspaceMessage"("userId", "createdAt");

ALTER TABLE "WorkspaceMessage" ADD CONSTRAINT "WorkspaceMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

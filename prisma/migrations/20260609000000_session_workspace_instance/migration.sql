ALTER TABLE "Session" ADD COLUMN "activeWorkspaceInstanceId" TEXT;
ALTER TABLE "Session" ADD COLUMN "activeWorkspaceSeenAt" TIMESTAMP(3);

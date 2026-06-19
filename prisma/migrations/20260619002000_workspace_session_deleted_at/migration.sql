-- Add soft-delete support for workspace sessions.
ALTER TABLE "WorkspaceSession" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "WorkspaceSession_userId_deletedAt_updatedAt_idx" ON "WorkspaceSession"("userId", "deletedAt", "updatedAt");

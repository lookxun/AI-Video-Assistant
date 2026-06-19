ALTER TABLE "MediaAsset" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "MediaAsset" ADD COLUMN "archiveReason" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "duplicateOfMediaAssetId" TEXT;

ALTER TABLE "UserAssetState" ADD COLUMN "hiddenAt" TIMESTAMP(3);
ALTER TABLE "UserAssetState" ADD COLUMN "hiddenReason" TEXT;

CREATE INDEX "MediaAsset_userId_archivedAt_idx" ON "MediaAsset"("userId", "archivedAt");
CREATE INDEX "UserAssetState_userId_hiddenAt_idx" ON "UserAssetState"("userId", "hiddenAt");

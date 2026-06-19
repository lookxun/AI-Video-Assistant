-- Canonical media registry. Media facts are immutable-ish; user visible asset state is separate.
CREATE TABLE "MediaAsset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mediaType" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "normalizedUrl" TEXT NOT NULL,
  "posterUrl" TEXT,
  "thumbnailUrl" TEXT,
  "originalUrl" TEXT,
  "storagePath" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "durationSeconds" INTEGER,
  "mimeType" TEXT,
  "fileSize" INTEGER,
  "sourceKind" TEXT NOT NULL,
  "sourceDetail" TEXT,
  "sourcePrompt" TEXT,
  "promptSource" TEXT,
  "reversePrompt" TEXT,
  "model" TEXT,
  "modelProvider" TEXT,
  "ratio" TEXT,
  "resolution" TEXT,
  "imageSize" TEXT,
  "videoDuration" TEXT,
  "generationSettings" JSONB,
  "previewMeta" JSONB,
  "originalFileName" TEXT,
  "systemName" TEXT,
  "initialName" TEXT,
  "initialCategory" TEXT,
  "creditLedgerId" TEXT,
  "requestId" TEXT,
  "conversationId" TEXT,
  "messageId" TEXT,
  "workflowId" TEXT,
  "workflowNodeId" TEXT,
  "legacyAssetId" TEXT,
  "legacyLibrarySource" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserAssetState" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "currentName" TEXT,
  "currentCategory" TEXT NOT NULL,
  "originalCategory" TEXT,
  "previousCategory" TEXT,
  "userRenamed" BOOLEAN NOT NULL DEFAULT false,
  "userRecategorized" BOOLEAN NOT NULL DEFAULT false,
  "lockedCategory" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER,
  "deletedAt" TIMESTAMP(3),
  "purgeAt" TIMESTAMP(3),
  "restoredAt" TIMESTAMP(3),
  "bytePlusAssetId" TEXT,
  "bytePlusAssetGroupId" TEXT,
  "bytePlusAssetStatus" TEXT,
  "bytePlusAssetError" TEXT,
  "bytePlusAssetUpdatedAt" TIMESTAMP(3),
  "legacyAssetJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserAssetState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaAsset_userId_normalizedUrl_key" ON "MediaAsset"("userId", "normalizedUrl");
CREATE INDEX "MediaAsset_userId_mediaType_createdAt_idx" ON "MediaAsset"("userId", "mediaType", "createdAt");
CREATE INDEX "MediaAsset_userId_sourceKind_createdAt_idx" ON "MediaAsset"("userId", "sourceKind", "createdAt");
CREATE INDEX "MediaAsset_conversationId_idx" ON "MediaAsset"("conversationId");
CREATE INDEX "MediaAsset_messageId_idx" ON "MediaAsset"("messageId");
CREATE INDEX "MediaAsset_workflowId_idx" ON "MediaAsset"("workflowId");

CREATE UNIQUE INDEX "UserAssetState_userId_mediaAssetId_key" ON "UserAssetState"("userId", "mediaAssetId");
CREATE INDEX "UserAssetState_userId_currentCategory_deletedAt_sortOrder_idx" ON "UserAssetState"("userId", "currentCategory", "deletedAt", "sortOrder");
CREATE INDEX "UserAssetState_userId_deletedAt_updatedAt_idx" ON "UserAssetState"("userId", "deletedAt", "updatedAt");

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAssetState" ADD CONSTRAINT "UserAssetState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAssetState" ADD CONSTRAINT "UserAssetState_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

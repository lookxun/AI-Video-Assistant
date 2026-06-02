-- AlterTable
ALTER TABLE "User" ADD COLUMN     "autoSaveHistory" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "generatedImageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "generatedVideoCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT '简体中文',
ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "notifyOnGenerationComplete" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phone" TEXT;

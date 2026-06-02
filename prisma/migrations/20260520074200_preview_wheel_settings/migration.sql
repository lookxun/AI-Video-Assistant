-- AlterTable
ALTER TABLE "User" ADD COLUMN     "previewWheelFlip" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "previewWheelZoom" BOOLEAN NOT NULL DEFAULT false;

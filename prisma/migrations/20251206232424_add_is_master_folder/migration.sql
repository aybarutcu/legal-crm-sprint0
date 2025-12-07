-- AlterTable
ALTER TABLE "DocumentFolder" ADD COLUMN     "isMasterFolder" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "DocumentFolder_isMasterFolder_idx" ON "DocumentFolder"("isMasterFolder");

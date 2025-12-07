-- CreateTable
CREATE TABLE "FolderTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "structure" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FolderTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FolderTemplate_createdById_idx" ON "FolderTemplate"("createdById");

-- CreateIndex
CREATE INDEX "FolderTemplate_isDefault_idx" ON "FolderTemplate"("isDefault");

-- AddForeignKey
ALTER TABLE "FolderTemplate" ADD CONSTRAINT "FolderTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

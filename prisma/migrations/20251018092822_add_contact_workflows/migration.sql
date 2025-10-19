-- AlterTable
ALTER TABLE "WorkflowInstance" ADD COLUMN     "contactId" TEXT,
ALTER COLUMN "matterId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "WorkflowInstance_contactId_status_idx" ON "WorkflowInstance"("contactId", "status");

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

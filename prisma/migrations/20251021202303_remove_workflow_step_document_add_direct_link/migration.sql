/*
  Warnings:

  - You are about to drop the `WorkflowStepDocument` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "WorkflowStepDocument" DROP CONSTRAINT "WorkflowStepDocument_attachedBy_fkey";

-- DropForeignKey
ALTER TABLE "WorkflowStepDocument" DROP CONSTRAINT "WorkflowStepDocument_documentId_fkey";

-- DropForeignKey
ALTER TABLE "WorkflowStepDocument" DROP CONSTRAINT "WorkflowStepDocument_stepId_fkey";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "workflowStepId" TEXT;

-- DropTable
DROP TABLE "WorkflowStepDocument";

-- CreateIndex
CREATE INDEX "Document_workflowStepId_idx" ON "Document"("workflowStepId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowInstanceStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "WorkflowStepDocument" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attachedBy" TEXT NOT NULL,

    CONSTRAINT "WorkflowStepDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowStepDocument_stepId_idx" ON "WorkflowStepDocument"("stepId");

-- CreateIndex
CREATE INDEX "WorkflowStepDocument_documentId_idx" ON "WorkflowStepDocument"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStepDocument_stepId_documentId_key" ON "WorkflowStepDocument"("stepId", "documentId");

-- AddForeignKey
ALTER TABLE "WorkflowStepDocument" ADD CONSTRAINT "WorkflowStepDocument_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "WorkflowInstanceStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStepDocument" ADD CONSTRAINT "WorkflowStepDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStepDocument" ADD CONSTRAINT "WorkflowStepDocument_attachedBy_fkey" FOREIGN KEY ("attachedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

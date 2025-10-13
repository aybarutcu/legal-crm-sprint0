-- AlterTable
ALTER TABLE "WorkflowInstance" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkflowInstanceStep" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkflowTemplate" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkflowTemplateStep" ALTER COLUMN "updatedAt" DROP DEFAULT;

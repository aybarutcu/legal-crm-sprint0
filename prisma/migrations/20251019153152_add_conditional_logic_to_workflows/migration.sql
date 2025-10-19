-- CreateEnum
CREATE TYPE "ConditionType" AS ENUM ('ALWAYS', 'IF_TRUE', 'IF_FALSE', 'SWITCH');

-- AlterTable
ALTER TABLE "WorkflowInstanceStep" ADD COLUMN     "conditionConfig" JSONB,
ADD COLUMN     "conditionType" "ConditionType" DEFAULT 'ALWAYS',
ADD COLUMN     "nextStepOnFalse" INTEGER,
ADD COLUMN     "nextStepOnTrue" INTEGER;

-- AlterTable
ALTER TABLE "WorkflowTemplateStep" ADD COLUMN     "conditionConfig" JSONB,
ADD COLUMN     "conditionType" "ConditionType" DEFAULT 'ALWAYS',
ADD COLUMN     "nextStepOnFalse" INTEGER,
ADD COLUMN     "nextStepOnTrue" INTEGER;

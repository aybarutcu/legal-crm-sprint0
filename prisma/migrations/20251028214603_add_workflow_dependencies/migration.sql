/*
  Warnings:

  - You are about to drop the column `dependencyLogic` on the `WorkflowInstanceStep` table. All the data in the column will be lost.
  - You are about to drop the column `dependsOn` on the `WorkflowInstanceStep` table. All the data in the column will be lost.
  - You are about to drop the column `dependencyLogic` on the `WorkflowTemplateStep` table. All the data in the column will be lost.
  - You are about to drop the column `dependsOn` on the `WorkflowTemplateStep` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('DEPENDS_ON', 'TRIGGERS', 'IF_TRUE_BRANCH', 'IF_FALSE_BRANCH');

-- CreateEnum
CREATE TYPE "ConditionType" AS ENUM ('ALWAYS', 'IF_TRUE', 'IF_FALSE', 'SWITCH');

-- AlterTable
ALTER TABLE "WorkflowInstanceStep" DROP COLUMN "dependencyLogic",
DROP COLUMN "dependsOn";

-- AlterTable
ALTER TABLE "WorkflowTemplateStep" DROP COLUMN "dependencyLogic",
DROP COLUMN "dependsOn";

-- CreateTable
CREATE TABLE "WorkflowTemplateDependency" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sourceStepId" TEXT NOT NULL,
    "targetStepId" TEXT NOT NULL,
    "dependencyType" "DependencyType" NOT NULL DEFAULT 'DEPENDS_ON',
    "dependencyLogic" "DependencyLogic" NOT NULL DEFAULT 'ALL',
    "conditionType" "ConditionType",
    "conditionConfig" JSONB,

    CONSTRAINT "WorkflowTemplateDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstanceDependency" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "sourceStepId" TEXT NOT NULL,
    "targetStepId" TEXT NOT NULL,
    "dependencyType" "DependencyType" NOT NULL DEFAULT 'DEPENDS_ON',
    "dependencyLogic" "DependencyLogic" NOT NULL DEFAULT 'ALL',
    "conditionType" "ConditionType",
    "conditionConfig" JSONB,

    CONSTRAINT "WorkflowInstanceDependency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowTemplateDependency_templateId_sourceStepId_targetSt_key" ON "WorkflowTemplateDependency"("templateId", "sourceStepId", "targetStepId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowInstanceDependency_instanceId_sourceStepId_targetSt_key" ON "WorkflowInstanceDependency"("instanceId", "sourceStepId", "targetStepId");

-- AddForeignKey
ALTER TABLE "WorkflowTemplateDependency" ADD CONSTRAINT "WorkflowTemplateDependency_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTemplateDependency" ADD CONSTRAINT "WorkflowTemplateDependency_sourceStepId_fkey" FOREIGN KEY ("sourceStepId") REFERENCES "WorkflowTemplateStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTemplateDependency" ADD CONSTRAINT "WorkflowTemplateDependency_targetStepId_fkey" FOREIGN KEY ("targetStepId") REFERENCES "WorkflowTemplateStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstanceDependency" ADD CONSTRAINT "WorkflowInstanceDependency_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstanceDependency" ADD CONSTRAINT "WorkflowInstanceDependency_sourceStepId_fkey" FOREIGN KEY ("sourceStepId") REFERENCES "WorkflowInstanceStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstanceDependency" ADD CONSTRAINT "WorkflowInstanceDependency_targetStepId_fkey" FOREIGN KEY ("targetStepId") REFERENCES "WorkflowInstanceStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

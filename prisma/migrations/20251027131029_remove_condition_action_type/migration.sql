/*
  Warnings:

  - You are about to drop the column `branches` on the `WorkflowInstanceStep` table. All the data in the column will be lost.
  - You are about to drop the column `conditionConfig` on the `WorkflowInstanceStep` table. All the data in the column will be lost.
  - You are about to drop the column `conditionType` on the `WorkflowInstanceStep` table. All the data in the column will be lost.
  - You are about to drop the column `branches` on the `WorkflowTemplateStep` table. All the data in the column will be lost.
  - You are about to drop the column `conditionConfig` on the `WorkflowTemplateStep` table. All the data in the column will be lost.
  - You are about to drop the column `conditionType` on the `WorkflowTemplateStep` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "WorkflowInstanceStep" DROP COLUMN "branches",
DROP COLUMN "conditionConfig",
DROP COLUMN "conditionType";

-- AlterTable
ALTER TABLE "WorkflowTemplateStep" DROP COLUMN "branches",
DROP COLUMN "conditionConfig",
DROP COLUMN "conditionType";

-- DropEnum
DROP TYPE "ConditionType";

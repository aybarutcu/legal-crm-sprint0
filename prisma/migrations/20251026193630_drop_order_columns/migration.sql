/*
  Warnings:

  - You are about to drop the column `order` on the `WorkflowInstanceStep` table. All the data in the column will be lost.
  - You are about to drop the column `order` on the `WorkflowTemplateStep` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "WorkflowInstanceStep_instanceId_order_key";

-- DropIndex
DROP INDEX "WorkflowTemplateStep_templateId_order_key";

-- AlterTable
ALTER TABLE "WorkflowInstanceStep" DROP COLUMN "order";

-- AlterTable
ALTER TABLE "WorkflowTemplateStep" DROP COLUMN "order";

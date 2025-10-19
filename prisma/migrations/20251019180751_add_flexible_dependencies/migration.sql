-- CreateEnum
CREATE TYPE "DependencyLogic" AS ENUM ('ALL', 'ANY', 'CUSTOM');

-- AlterTable
ALTER TABLE "WorkflowInstanceStep" ADD COLUMN     "dependencyLogic" "DependencyLogic" NOT NULL DEFAULT 'ALL',
ADD COLUMN     "dependsOn" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "WorkflowTemplateStep" ADD COLUMN     "dependencyLogic" "DependencyLogic" NOT NULL DEFAULT 'ALL',
ADD COLUMN     "dependsOn" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

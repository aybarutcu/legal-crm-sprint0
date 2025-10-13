-- Drop existing workflow tables
DROP TABLE IF EXISTS "WorkflowInstanceStep";
DROP TABLE IF EXISTS "WorkflowInstance";
DROP TABLE IF EXISTS "WorkflowStep";
DROP TABLE IF EXISTS "WorkflowTemplate";

-- Drop legacy enums
DO $$ BEGIN
  DROP TYPE IF EXISTS "WorkflowStepType";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP TYPE IF EXISTS "WorkflowInstanceStatus";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create enums for action engine
CREATE TYPE "ActionType" AS ENUM ('APPROVAL_LAWYER', 'SIGNATURE_CLIENT', 'REQUEST_DOC_CLIENT', 'PAYMENT_CLIENT', 'CHECKLIST');

CREATE TYPE "RoleScope" AS ENUM ('ADMIN', 'LAWYER', 'PARALEGAL', 'CLIENT');

CREATE TYPE "ActionState" AS ENUM ('PENDING', 'READY', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'FAILED', 'SKIPPED');

CREATE TYPE "WorkflowInstanceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELED');

-- Recreate workflow tables with new structure
CREATE TABLE "WorkflowTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowTemplateStep" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "actionConfig" JSONB NOT NULL,
    "roleScope" "RoleScope" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowTemplateStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowInstanceStep" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "templateStepId" TEXT,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "roleScope" "RoleScope" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "actionState" "ActionState" NOT NULL DEFAULT 'PENDING',
    "actionData" JSONB,
    "assignedToId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowInstanceStep_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "WorkflowTemplate_name_version_key" ON "WorkflowTemplate"("name", "version");

CREATE UNIQUE INDEX "WorkflowTemplateStep_templateId_order_key" ON "WorkflowTemplateStep"("templateId", "order");

CREATE UNIQUE INDEX "WorkflowInstanceStep_instanceId_order_key" ON "WorkflowInstanceStep"("instanceId", "order");

CREATE INDEX "WorkflowInstanceStep_instanceId_actionState_idx" ON "WorkflowInstanceStep"("instanceId", "actionState");

CREATE INDEX "WorkflowInstanceStep_assignedToId_idx" ON "WorkflowInstanceStep"("assignedToId");

CREATE INDEX "WorkflowInstance_matterId_status_idx" ON "WorkflowInstance"("matterId", "status");

CREATE INDEX "WorkflowInstance_createdById_idx" ON "WorkflowInstance"("createdById");

-- Foreign keys
ALTER TABLE "WorkflowTemplate"
  ADD CONSTRAINT "WorkflowTemplate_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkflowTemplateStep"
  ADD CONSTRAINT "WorkflowTemplateStep_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowInstance"
  ADD CONSTRAINT "WorkflowInstance_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkflowInstance"
  ADD CONSTRAINT "WorkflowInstance_matterId_fkey"
  FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowInstance"
  ADD CONSTRAINT "WorkflowInstance_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkflowInstanceStep"
  ADD CONSTRAINT "WorkflowInstanceStep_instanceId_fkey"
  FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowInstanceStep"
  ADD CONSTRAINT "WorkflowInstanceStep_templateStepId_fkey"
  FOREIGN KEY ("templateStepId") REFERENCES "WorkflowTemplateStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkflowInstanceStep"
  ADD CONSTRAINT "WorkflowInstanceStep_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

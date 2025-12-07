-- Switch dependency references from order-based integers to step ID strings

-- Template steps: drop order-based columns and replace with ID-based versions
ALTER TABLE "WorkflowTemplateStep"
  DROP COLUMN IF EXISTS "nextStepOnTrue",
  DROP COLUMN IF EXISTS "nextStepOnFalse",
  DROP COLUMN IF EXISTS "dependsOn";

ALTER TABLE "WorkflowTemplateStep"
  ADD COLUMN "nextStepOnTrue" TEXT,
  ADD COLUMN "nextStepOnFalse" TEXT,
  ADD COLUMN "dependsOn" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Instance steps: replace branch columns
ALTER TABLE "WorkflowInstanceStep"
  DROP COLUMN IF EXISTS "nextStepOnTrue",
  DROP COLUMN IF EXISTS "nextStepOnFalse";

ALTER TABLE "WorkflowInstanceStep"
  ADD COLUMN "nextStepOnTrue" TEXT,
  ADD COLUMN "nextStepOnFalse" TEXT;

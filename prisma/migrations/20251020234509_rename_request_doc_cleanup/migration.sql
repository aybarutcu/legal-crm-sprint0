-- Step 2: Update existing data to use the new enum value  
UPDATE "WorkflowTemplateStep" SET "actionType" = 'REQUEST_DOC' WHERE "actionType" = 'REQUEST_DOC';
UPDATE "WorkflowInstanceStep" SET "actionType" = 'REQUEST_DOC' WHERE "actionType" = 'REQUEST_DOC';

-- Step 3: Remove the old enum value
BEGIN;
CREATE TYPE "ActionType_new" AS ENUM ('APPROVAL', 'SIGNATURE', 'REQUEST_DOC', 'PAYMENT', 'TASK', 'CHECKLIST', 'WRITE_TEXT', 'POPULATE_QUESTIONNAIRE', 'AUTOMATION_EMAIL', 'AUTOMATION_WEBHOOK');
ALTER TABLE "WorkflowTemplateStep" ALTER COLUMN "actionType" TYPE "ActionType_new" USING ("actionType"::text::"ActionType_new");
ALTER TABLE "WorkflowInstanceStep" ALTER COLUMN "actionType" TYPE "ActionType_new" USING ("actionType"::text::"ActionType_new");
ALTER TYPE "ActionType" RENAME TO "ActionType_old";
ALTER TYPE "ActionType_new" RENAME TO "ActionType";
DROP TYPE "ActionType_old";
COMMIT;

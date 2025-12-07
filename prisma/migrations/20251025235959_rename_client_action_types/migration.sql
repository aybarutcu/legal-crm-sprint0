-- Rename legacy client-specific action types to consolidated workflow action names
BEGIN;

ALTER TYPE "ActionType" RENAME TO "ActionType_old";

CREATE TYPE "ActionType" AS ENUM (
  'APPROVAL',
  'SIGNATURE',
  'REQUEST_DOC',
  'PAYMENT',
  'TASK',
  'CHECKLIST',
  'WRITE_TEXT',
  'POPULATE_QUESTIONNAIRE'
);

ALTER TABLE "WorkflowTemplateStep"
  ALTER COLUMN "actionType" TYPE "ActionType"
  USING (
    CASE
      WHEN "actionType"::text = 'APPROVAL_LAWYER' THEN 'APPROVAL'
      WHEN "actionType"::text = 'SIGNATURE_CLIENT' THEN 'SIGNATURE'
      WHEN "actionType"::text = 'REQUEST_DOC_CLIENT' THEN 'REQUEST_DOC'
      WHEN "actionType"::text = 'PAYMENT_CLIENT' THEN 'PAYMENT'
      ELSE "actionType"::text
    END
  )::"ActionType";

ALTER TABLE "WorkflowInstanceStep"
  ALTER COLUMN "actionType" TYPE "ActionType"
  USING (
    CASE
      WHEN "actionType"::text = 'APPROVAL_LAWYER' THEN 'APPROVAL'
      WHEN "actionType"::text = 'SIGNATURE_CLIENT' THEN 'SIGNATURE'
      WHEN "actionType"::text = 'REQUEST_DOC_CLIENT' THEN 'REQUEST_DOC'
      WHEN "actionType"::text = 'PAYMENT_CLIENT' THEN 'PAYMENT'
      ELSE "actionType"::text
    END
  )::"ActionType";

DROP TYPE "ActionType_old";

COMMIT;

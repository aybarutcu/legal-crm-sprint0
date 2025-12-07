/*
  Warnings:

  - You are about to drop the column `nextStepOnFalse` on the `WorkflowInstanceStep` table. All the data in the column will be lost.
  - You are about to drop the column `nextStepOnTrue` on the `WorkflowInstanceStep` table. All the data in the column will be lost.
  - You are about to drop the column `nextStepOnFalse` on the `WorkflowTemplateStep` table. All the data in the column will be lost.
  - You are about to drop the column `nextStepOnTrue` on the `WorkflowTemplateStep` table. All the data in the column will be lost.

*/
-- Add branches column first
ALTER TABLE "WorkflowInstanceStep" ADD COLUMN "branches" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "WorkflowTemplateStep" ADD COLUMN "branches" JSONB NOT NULL DEFAULT '[]';

-- Migrate WorkflowTemplateStep branching data
UPDATE "WorkflowTemplateStep"
SET "branches" = (
  CASE
    WHEN "nextStepOnTrue" IS NOT NULL AND "nextStepOnFalse" IS NOT NULL THEN
      json_build_array(
        json_build_object('label', 'Approve', 'targetStepId', "nextStepOnTrue", 'condition', 'true')::jsonb,
        json_build_object('label', 'Reject', 'targetStepId', "nextStepOnFalse", 'condition', 'false')::jsonb
      )::jsonb
    WHEN "nextStepOnTrue" IS NOT NULL THEN
      json_build_array(
        json_build_object('label', 'Approve', 'targetStepId', "nextStepOnTrue", 'condition', 'true')::jsonb
      )::jsonb
    WHEN "nextStepOnFalse" IS NOT NULL THEN
      json_build_array(
        json_build_object('label', 'Reject', 'targetStepId', "nextStepOnFalse", 'condition', 'false')::jsonb
      )::jsonb
    ELSE '[]'::jsonb
  END
);

-- Migrate WorkflowInstanceStep branching data
UPDATE "WorkflowInstanceStep"
SET "branches" = (
  CASE
    WHEN "nextStepOnTrue" IS NOT NULL AND "nextStepOnFalse" IS NOT NULL THEN
      json_build_array(
        json_build_object('label', 'Approve', 'targetStepId', "nextStepOnTrue", 'condition', 'true')::jsonb,
        json_build_object('label', 'Reject', 'targetStepId', "nextStepOnFalse", 'condition', 'false')::jsonb
      )::jsonb
    WHEN "nextStepOnTrue" IS NOT NULL THEN
      json_build_array(
        json_build_object('label', 'Approve', 'targetStepId', "nextStepOnTrue", 'condition', 'true')::jsonb
      )::jsonb
    WHEN "nextStepOnFalse" IS NOT NULL THEN
      json_build_array(
        json_build_object('label', 'Reject', 'targetStepId', "nextStepOnFalse", 'condition', 'false')::jsonb
      )::jsonb
    ELSE '[]'::jsonb
  END
);

-- Drop old columns
ALTER TABLE "WorkflowInstanceStep" DROP COLUMN "nextStepOnFalse",
DROP COLUMN "nextStepOnTrue";

ALTER TABLE "WorkflowTemplateStep" DROP COLUMN "nextStepOnFalse",
DROP COLUMN "nextStepOnTrue";

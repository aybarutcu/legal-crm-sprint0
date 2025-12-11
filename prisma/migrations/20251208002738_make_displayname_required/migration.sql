/*
  Warnings:

  - Made the column `displayName` on table `Document` required. This step will fail if there are existing NULL values in that column.

*/

-- Step 1: Backfill displayName with filename where it's null
UPDATE "Document" SET "displayName" = "filename" WHERE "displayName" IS NULL;

-- Step 2: Make the column required
ALTER TABLE "Document" ALTER COLUMN "displayName" SET NOT NULL;

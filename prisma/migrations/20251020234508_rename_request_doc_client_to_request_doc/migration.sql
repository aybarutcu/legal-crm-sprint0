/*
  Warnings:

  - The values [REQUEST_DOC] on the enum `ActionType` will be removed. If these variants are still used in the database, this will fail.

*/
-- Step 1: Add new enum value (must be in separate transaction)
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'REQUEST_DOC';


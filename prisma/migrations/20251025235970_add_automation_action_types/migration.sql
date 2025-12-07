-- Add automation-focused action types for system-driven steps
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'AUTOMATION_EMAIL';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'AUTOMATION_WEBHOOK';

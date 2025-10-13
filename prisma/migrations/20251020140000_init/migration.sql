-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'LAWYER', 'PARALEGAL');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('LEAD', 'CLIENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'QUALIFIED', 'DISQUALIFIED', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MatterStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ON_HOLD', 'CLOSED');

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('PLAINTIFF', 'DEFENDANT', 'WITNESS', 'OPPOSING_COUNSEL');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "WorkflowStepType" AS ENUM ('task', 'checklist');

-- CreateEnum
CREATE TYPE "WorkflowInstanceStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('LOCAL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "ParentType" AS ENUM ('MATTER', 'CONTACT', 'DOCUMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'LAWYER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "type" "ContactType" NOT NULL DEFAULT 'LEAD',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT,
    "tags" TEXT[],
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matter" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "MatterStatus" NOT NULL DEFAULT 'OPEN',
    "jurisdiction" TEXT,
    "court" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextHearingAt" TIMESTAMP(3),
    "clientId" TEXT NOT NULL,
    "ownerId" TEXT,

    CONSTRAINT "Matter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterContact" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" "PartyRole" NOT NULL,

    CONSTRAINT "MatterContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "matterId" TEXT,
    "contactId" TEXT,
    "uploaderId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "tags" TEXT[],
    "storageKey" TEXT NOT NULL,
    "hash" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT,
    "matterId" TEXT,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "attendees" JSONB NOT NULL DEFAULT '[]',
    "reminderMinutes" INTEGER NOT NULL DEFAULT 30,
    "externalCalId" TEXT,
    "externalEtag" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calendar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL DEFAULT 'LOCAL',
    "externalId" TEXT,
    "syncToken" TEXT,
    "webhookChannelId" TEXT,
    "webhookResourceId" TEXT,
    "webhookExpirationAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "defaultReminderMinutes" INTEGER NOT NULL DEFAULT 30,
    "icsTokenHash" TEXT,
    "icsTokenCreatedAt" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "matterId" TEXT,
    "assigneeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3),
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reminderNotified" BOOLEAN NOT NULL DEFAULT false,
    "reminderNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskChecklist" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskLink" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "documentId" TEXT,
    "eventId" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "type" "WorkflowStepType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstanceStep" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "taskId" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowInstanceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "parentType" "ParentType" NOT NULL,
    "parentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "MatterContact_matterId_contactId_role_key" ON "MatterContact"("matterId", "contactId", "role");

-- CreateIndex
CREATE INDEX "Document_matterId_filename_idx" ON "Document"("matterId", "filename");

-- CreateIndex
CREATE INDEX "Document_contactId_idx" ON "Document"("contactId");

-- CreateIndex
CREATE INDEX "Document_matterId_hash_idx" ON "Document"("matterId", "hash");

-- CreateIndex
CREATE INDEX "Event_startAt_idx" ON "Event"("startAt");

-- CreateIndex
CREATE INDEX "Event_calendarId_externalCalId_idx" ON "Event"("calendarId", "externalCalId");

-- CreateIndex
CREATE INDEX "Calendar_userId_idx" ON "Calendar"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Calendar_userId_provider_key" ON "Calendar"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Calendar_userId_externalId_key" ON "Calendar"("userId", "externalId");

-- CreateIndex
CREATE INDEX "Task_matterId_idx" ON "Task"("matterId");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

-- CreateIndex
CREATE INDEX "Task_dueAt_idx" ON "Task"("dueAt");

-- CreateIndex
CREATE INDEX "Task_assigneeId_status_dueAt_idx" ON "Task"("assigneeId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "TaskChecklist_taskId_idx" ON "TaskChecklist"("taskId");

-- CreateIndex
CREATE INDEX "TaskChecklist_taskId_order_idx" ON "TaskChecklist"("taskId", "order");

-- CreateIndex
CREATE INDEX "TaskLink_taskId_idx" ON "TaskLink"("taskId");

-- CreateIndex
CREATE INDEX "TaskLink_documentId_idx" ON "TaskLink"("documentId");

-- CreateIndex
CREATE INDEX "TaskLink_eventId_idx" ON "TaskLink"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowTemplate_name_key" ON "WorkflowTemplate"("name");

-- CreateIndex
CREATE INDEX "WorkflowStep_templateId_order_idx" ON "WorkflowStep"("templateId", "order");

-- CreateIndex
CREATE INDEX "WorkflowInstance_matterId_idx" ON "WorkflowInstance"("matterId");

-- CreateIndex
CREATE INDEX "WorkflowInstance_createdById_idx" ON "WorkflowInstance"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowInstanceStep_taskId_key" ON "WorkflowInstanceStep"("taskId");

-- CreateIndex
CREATE INDEX "WorkflowInstanceStep_taskId_idx" ON "WorkflowInstanceStep"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowInstanceStep_instanceId_stepId_key" ON "WorkflowInstanceStep"("instanceId", "stepId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterContact" ADD CONSTRAINT "MatterContact_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterContact" ADD CONSTRAINT "MatterContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "Calendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calendar" ADD CONSTRAINT "Calendar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskChecklist" ADD CONSTRAINT "TaskChecklist_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskLink" ADD CONSTRAINT "TaskLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskLink" ADD CONSTRAINT "TaskLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskLink" ADD CONSTRAINT "TaskLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTemplate" ADD CONSTRAINT "WorkflowTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstanceStep" ADD CONSTRAINT "WorkflowInstanceStep_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstanceStep" ADD CONSTRAINT "WorkflowInstanceStep_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "WorkflowStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstanceStep" ADD CONSTRAINT "WorkflowInstanceStep_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

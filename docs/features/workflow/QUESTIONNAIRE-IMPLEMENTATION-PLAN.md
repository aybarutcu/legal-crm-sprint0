# Questionnaire Feature - Implementation Plan

**Created**: October 16, 2025  
**Status**: 📋 Planning  
**Epic**: Questionnaire Management & POPULATE_QUESTIONNAIRE Workflow Action

---

## 🎯 Overview

Implement a comprehensive questionnaire system that allows lawyers to create reusable questionnaires with multiple question types, then assign them to clients via a new `POPULATE_QUESTIONNAIRE` workflow action. This feature enables structured data collection from clients within workflows.

### Goals

1. **Questionnaire Management**: Create, edit, and manage reusable questionnaires
2. **Question Types**: Support free text, single-choice, and multi-choice questions
3. **Workflow Integration**: New `POPULATE_QUESTIONNAIRE` action type for workflows
4. **Client Experience**: User-friendly form interface in client portal
5. **Data Collection**: Store and display questionnaire responses

---

## 📐 Architecture

### Data Model

```prisma
// New models to add to schema.prisma

model Questionnaire {
  id          String   @id @default(cuid())
  title       String
  description String?
  isActive    Boolean  @default(true)
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
  deletedBy   String?

  createdBy User                      @relation("QuestionnaireCreator", fields: [createdById], references: [id])
  questions QuestionnaireQuestion[]
  responses QuestionnaireResponse[]

  @@index([createdById])
  @@index([isActive])
  @@index([createdAt])
}

model QuestionnaireQuestion {
  id              String   @id @default(cuid())
  questionnaireId String
  questionText    String
  questionType    QuestionType
  order           Int      @default(0)
  required        Boolean  @default(true)
  placeholder     String?
  helpText        String?
  options         Json?    // Array of options for single/multi-choice: ["Option 1", "Option 2"]
  validation      Json?    // Validation rules: { minLength, maxLength, pattern, etc. }
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  questionnaire Questionnaire                  @relation(fields: [questionnaireId], references: [id], onDelete: Cascade)
  answers       QuestionnaireResponseAnswer[]

  @@unique([questionnaireId, order])
  @@index([questionnaireId])
}

enum QuestionType {
  FREE_TEXT         // Long text input
  SINGLE_CHOICE     // Radio buttons
  MULTI_CHOICE      // Checkboxes
}

model QuestionnaireResponse {
  id              String   @id @default(cuid())
  questionnaireId String
  workflowStepId  String?  // Link to workflow step if used in workflow
  matterId        String?  // Link to matter
  respondentId    String   // User who filled the questionnaire
  status          ResponseStatus @default(IN_PROGRESS)
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  questionnaire Questionnaire                  @relation(fields: [questionnaireId], references: [id])
  respondent    User                           @relation("QuestionnaireRespondent", fields: [respondentId], references: [id])
  matter        Matter?                        @relation(fields: [matterId], references: [id])
  answers       QuestionnaireResponseAnswer[]

  @@index([questionnaireId])
  @@index([workflowStepId])
  @@index([matterId])
  @@index([respondentId])
  @@index([status])
}

enum ResponseStatus {
  IN_PROGRESS
  COMPLETED
  ABANDONED
}

model QuestionnaireResponseAnswer {
  id         String   @id @default(cuid())
  responseId String
  questionId String
  answerText String?  // For FREE_TEXT
  answerJson Json?    // For SINGLE_CHOICE (string) or MULTI_CHOICE (array of strings)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  response QuestionnaireResponse  @relation(fields: [responseId], references: [id], onDelete: Cascade)
  question QuestionnaireQuestion  @relation(fields: [questionId], references: [id])

  @@unique([responseId, questionId])
  @@index([responseId])
  @@index([questionId])
}
```

### Enum Addition

```prisma
// Add to existing ActionType enum
enum ActionType {
  APPROVAL_LAWYER
  SIGNATURE_CLIENT
  REQUEST_DOC_CLIENT
  PAYMENT_CLIENT
  CHECKLIST
  WRITE_TEXT
  POPULATE_QUESTIONNAIRE  // NEW
}
```

---

## 🗂️ File Structure

### New Files to Create

```
app/(dashboard)/
  questionnaires/
    page.tsx                          # Questionnaire list page
    [id]/
      page.tsx                        # Questionnaire detail/edit page
      responses/
        page.tsx                      # View all responses for questionnaire

components/
  questionnaires/
    QuestionnaireListClient.tsx       # List view with filters
    QuestionnaireCreateDialog.tsx     # Create new questionnaire modal
    QuestionnaireEditor.tsx           # Main editor component
    QuestionEditorCard.tsx            # Single question editor
    QuestionnairePreview.tsx          # Preview how it looks to client
    ResponseViewer.tsx                # View completed responses
    ResponseListClient.tsx            # List of responses
    types.ts                          # TypeScript types

  workflows/
    config-forms/
      PopulateQuestionnaireConfigForm.tsx  # Config form for action
    execution/
      PopulateQuestionnaireExecution.tsx   # Client-facing questionnaire form

lib/
  workflows/
    handlers/
      populate-questionnaire.ts       # Workflow action handler

  validation/
    questionnaire.ts                  # Zod validation schemas

app/api/
  questionnaires/
    route.ts                          # GET (list), POST (create)
    [id]/
      route.ts                        # GET (detail), PATCH (update), DELETE
      responses/
        route.ts                      # GET responses for questionnaire
        [responseId]/
          route.ts                    # GET single response
  questionnaire-responses/
    route.ts                          # POST (start response)
    [id]/
      route.ts                        # GET, PATCH (update answers), POST (complete)
```

---

## 📝 Implementation Phases

### Phase 1: Database Schema & API Foundation (2-3 hours)

**Tasks:**
1. ✅ Add new models to `prisma/schema.prisma`
2. ✅ Add `POPULATE_QUESTIONNAIRE` to ActionType enum
3. ✅ Run migration: `npx prisma migrate dev --name add_questionnaires`
4. ✅ Create validation schemas in `lib/validation/questionnaire.ts`

**Validation Schemas:**
```typescript
// lib/validation/questionnaire.ts
import { z } from "zod";

export const questionTypeSchema = z.enum(["FREE_TEXT", "SINGLE_CHOICE", "MULTI_CHOICE"]);

export const questionSchema = z.object({
  questionText: z.string().min(1, "Question text is required"),
  questionType: questionTypeSchema,
  order: z.number().int().min(0),
  required: z.boolean().default(true),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  options: z.array(z.string()).optional(), // Required for SINGLE/MULTI_CHOICE
  validation: z.object({
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(1).optional(),
    minChoices: z.number().int().min(1).optional(), // For MULTI_CHOICE
    maxChoices: z.number().int().min(1).optional(), // For MULTI_CHOICE
  }).optional(),
});

export const questionnaireCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  questions: z.array(questionSchema).min(1, "At least one question required"),
});

export const questionnaireUpdateSchema = questionnaireCreateSchema.partial();

export const answerSchema = z.object({
  questionId: z.string().cuid(),
  answerText: z.string().optional(),
  answerJson: z.union([z.string(), z.array(z.string())]).optional(),
});

export const responseSubmitSchema = z.object({
  answers: z.array(answerSchema),
});
```

---

### Phase 2: API Endpoints (3-4 hours)

#### 2.1 Questionnaire CRUD APIs

**`/app/api/questionnaires/route.ts`**
```typescript
// GET - List questionnaires with filters
// POST - Create new questionnaire
export const GET = withApiHandler(async (req, { session }) => {
  const user = session!.user!;
  
  // Only ADMIN/LAWYER can manage questionnaires
  if (!["ADMIN", "LAWYER"].includes(user.role!)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const search = searchParams.get("search") || undefined;
  const isActive = searchParams.get("isActive") === "true" ? true : undefined;
  
  const questionnaires = await prisma.questionnaire.findMany({
    where: {
      deletedAt: null,
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { questions: true, responses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ questionnaires });
});

export const POST = withApiHandler(async (req, { session }) => {
  const user = session!.user!;
  
  if (!["ADMIN", "LAWYER"].includes(user.role!)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = questionnaireCreateSchema.parse(await req.json());

  const questionnaire = await prisma.questionnaire.create({
    data: {
      title: body.title,
      description: body.description,
      createdById: user.id,
      questions: {
        create: body.questions.map((q, idx) => ({
          ...q,
          order: idx,
          options: q.options ? JSON.stringify(q.options) : undefined,
          validation: q.validation ? JSON.stringify(q.validation) : undefined,
        })),
      },
    },
    include: {
      questions: { orderBy: { order: "asc" } },
    },
  });

  return NextResponse.json({ questionnaire }, { status: 201 });
});
```

**`/app/api/questionnaires/[id]/route.ts`**
```typescript
// GET - Get single questionnaire with questions
// PATCH - Update questionnaire
// DELETE - Soft delete questionnaire
```

#### 2.2 Response APIs

**`/app/api/questionnaire-responses/route.ts`**
```typescript
// POST - Start a new response (create in-progress response)
export const POST = withApiHandler(async (req, { session }) => {
  const user = session!.user!;
  
  const { questionnaireId, workflowStepId, matterId } = await req.json();

  const response = await prisma.questionnaireResponse.create({
    data: {
      questionnaireId,
      workflowStepId,
      matterId,
      respondentId: user.id,
      status: "IN_PROGRESS",
    },
  });

  return NextResponse.json({ response }, { status: 201 });
});
```

**`/app/api/questionnaire-responses/[id]/route.ts`**
```typescript
// GET - Get response with answers
// PATCH - Update answers (save progress)
// POST - Complete response (mark as completed)
```

---

### Phase 3: Workflow Action Handler (2-3 hours)

**`/lib/workflows/handlers/populate-questionnaire.ts`**

```typescript
import { ActionState, ActionType, Role } from "@prisma/client";
import { z } from "zod";
import type { IActionHandler, WorkflowRuntimeContext } from "../types";
import { ActionHandlerError } from "../errors";

const configSchema = z.object({
  questionnaireId: z.string().cuid("Invalid questionnaire ID"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueInDays: z.number().int().min(1).optional(),
});

const completePayloadSchema = z.object({
  responseId: z.string().cuid(),
});

export type PopulateQuestionnaireConfig = z.infer<typeof configSchema>;
export type PopulateQuestionnaireData = {
  responseId?: string;
  questionnaireId?: string;
  startedAt?: string;
  completedAt?: string;
  completedBy?: string;
};

/**
 * PopulateQuestionnaireActionHandler
 * 
 * Assigns a questionnaire to be filled out as part of a workflow step.
 * Typically assigned to CLIENT role, but can be used for any role.
 * 
 * Configuration:
 * - questionnaireId: The questionnaire to populate
 * - title: Step title (e.g., "Complete Client Intake Form")
 * - description: Additional instructions
 * - dueInDays: Optional deadline in days
 * 
 * Complete Payload:
 * - responseId: The completed questionnaire response ID
 * 
 * Data stored:
 * - responseId: Link to the response
 * - questionnaireId: Link to questionnaire template
 * - startedAt: When user started
 * - completedAt: When user completed
 * - completedBy: User ID who completed
 */
export class PopulateQuestionnaireActionHandler 
  implements IActionHandler<PopulateQuestionnaireConfig, PopulateQuestionnaireData> {
  
  readonly type = ActionType.POPULATE_QUESTIONNAIRE;

  validateConfig(config: PopulateQuestionnaireConfig): void {
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) {
      throw new ActionHandlerError(
        `Invalid POPULATE_QUESTIONNAIRE config: ${parsed.error.message}`,
        "INVALID_CONFIG"
      );
    }
  }

  canStart(ctx: WorkflowRuntimeContext<PopulateQuestionnaireConfig, PopulateQuestionnaireData>): boolean {
    if (!ctx.actor) {
      return false;
    }

    // Admins can always start
    if (ctx.actor.role === Role.ADMIN) {
      return true;
    }

    // Otherwise rely on roleScope validation
    return true;
  }

  async start(
    ctx: WorkflowRuntimeContext<PopulateQuestionnaireConfig, PopulateQuestionnaireData>
  ): Promise<ActionState> {
    const config = configSchema.parse(ctx.config);
    
    // Verify questionnaire exists
    const questionnaire = await ctx.tx.questionnaire.findUnique({
      where: { id: config.questionnaireId, deletedAt: null, isActive: true },
    });

    if (!questionnaire) {
      throw new ActionHandlerError(
        "Questionnaire not found or inactive",
        "QUESTIONNAIRE_NOT_FOUND"
      );
    }

    // Store questionnaire ID in step data
    ctx.data.questionnaireId = config.questionnaireId;
    ctx.data.startedAt = ctx.now.toISOString();

    // Update workflow context
    ctx.updateContext({
      questionnaireStarted: true,
      questionnaireId: config.questionnaireId,
      questionnaireTitle: questionnaire.title,
    });

    return ActionState.IN_PROGRESS;
  }

  async complete(
    ctx: WorkflowRuntimeContext<PopulateQuestionnaireConfig, PopulateQuestionnaireData>,
    payload?: unknown
  ): Promise<ActionState> {
    const parsed = completePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ActionHandlerError(
        `Invalid completion payload: ${parsed.error.message}`,
        "INVALID_PAYLOAD"
      );
    }

    const { responseId } = parsed.data;

    // Verify response exists and is completed
    const response = await ctx.tx.questionnaireResponse.findUnique({
      where: { id: responseId },
      include: {
        answers: true,
        questionnaire: true,
      },
    });

    if (!response) {
      throw new ActionHandlerError("Response not found", "RESPONSE_NOT_FOUND");
    }

    if (response.status !== "COMPLETED") {
      throw new ActionHandlerError(
        "Response must be completed before finishing step",
        "RESPONSE_NOT_COMPLETED"
      );
    }

    // Store completion data
    ctx.data.responseId = responseId;
    ctx.data.completedAt = ctx.now.toISOString();
    ctx.data.completedBy = ctx.actor?.id;

    // Update workflow context
    ctx.updateContext({
      questionnaireCompleted: true,
      questionnaireResponseId: responseId,
      questionnaireAnswerCount: response.answers.length,
      questionnaireCompletedAt: ctx.now.toISOString(),
    });

    return ActionState.COMPLETED;
  }

  async fail(
    _ctx: WorkflowRuntimeContext<PopulateQuestionnaireConfig, PopulateQuestionnaireData>,
    _reason: string
  ): Promise<ActionState> {
    return ActionState.FAILED;
  }

  getNextStateOnEvent(
    ctx: WorkflowRuntimeContext<PopulateQuestionnaireConfig, PopulateQuestionnaireData>,
    event: import("../types").ActionEvent
  ): ActionState | null {
    // Support external completion via webhook/event
    if (event.type === "QUESTIONNAIRE_COMPLETED") {
      if (typeof event.payload === "object" && event.payload !== null) {
        const responseId = (event.payload as Record<string, unknown>).responseId;
        if (responseId && typeof responseId === "string") {
          ctx.data.responseId = responseId;
          ctx.data.completedAt = ctx.now.toISOString();
          return ActionState.COMPLETED;
        }
      }
    }
    return null;
  }
}
```

**Register Handler:**
```typescript
// lib/workflows/handlers/index.ts
import { PopulateQuestionnaireActionHandler } from "./populate-questionnaire";

export function registerDefaultWorkflowHandlers(): void {
  // ... existing handlers
  actionRegistry.override(new PopulateQuestionnaireActionHandler());
}

export { PopulateQuestionnaireActionHandler } from "./populate-questionnaire";
```

---

### Phase 4: Questionnaire Management UI (4-5 hours)

#### 4.1 List Page

**`/app/(dashboard)/questionnaires/page.tsx`**
```tsx
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { QuestionnaireListClient } from "@/components/questionnaires/QuestionnaireListClient";

export default async function QuestionnairesPage({
  searchParams,
}: {
  searchParams: { search?: string; isActive?: string };
}) {
  const session = await getAuthSession();
  
  if (!session?.user || !["ADMIN", "LAWYER"].includes(session.user.role!)) {
    redirect("/dashboard");
  }

  const search = searchParams.search;
  const isActive = searchParams.isActive === "true" ? true : undefined;

  const questionnaires = await prisma.questionnaire.findMany({
    where: {
      deletedAt: null,
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { questions: true, responses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <QuestionnaireListClient
      questionnaires={questionnaires}
      currentUserRole={session.user.role!}
    />
  );
}
```

#### 4.2 List Component

**`/components/questionnaires/QuestionnaireListClient.tsx`**
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionnaireCreateDialog } from "./QuestionnaireCreateDialog";
import Link from "next/link";

type Questionnaire = {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: { id: string; name: string | null; email: string | null };
  _count: { questions: number; responses: number };
};

export function QuestionnaireListClient({
  questionnaires,
  currentUserRole,
}: {
  questionnaires: Questionnaire[];
  currentUserRole: string;
}) {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Anketler</h1>
          <p className="mt-2 text-sm text-slate-600">
            Müvekkiller için anket formları oluşturun ve yönetin
          </p>
        </div>
        <button
          onClick={() => setCreateDialogOpen(true)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
        >
          + Yeni Anket
        </button>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <form method="get" className="flex gap-4">
          <input
            type="search"
            name="search"
            placeholder="Anket ara..."
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <select
            name="isActive"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-accent focus:outline-none"
          >
            <option value="">Tüm Durumlar</option>
            <option value="true">Aktif</option>
            <option value="false">Pasif</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Filtrele
          </button>
        </form>
      </div>

      {/* Questionnaire Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {questionnaires.map((q) => (
          <Link
            key={q.id}
            href={`/questionnaires/${q.id}`}
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition-all hover:shadow-lg"
          >
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-lg font-semibold text-slate-900 group-hover:text-accent">
                {q.title}
              </h3>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  q.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {q.isActive ? "Aktif" : "Pasif"}
              </span>
            </div>

            {q.description && (
              <p className="mb-4 text-sm text-slate-600 line-clamp-2">
                {q.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>{q._count.questions} soru</span>
              <span>•</span>
              <span>{q._count.responses} yanıt</span>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <span className="truncate">
                {q.createdBy.name || q.createdBy.email}
              </span>
              <span>•</span>
              <span>{new Date(q.createdAt).toLocaleDateString("tr-TR")}</span>
            </div>
          </Link>
        ))}
      </div>

      {questionnaires.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-card">
          <p className="text-slate-600">Henüz anket oluşturulmamış.</p>
          <button
            onClick={() => setCreateDialogOpen(true)}
            className="mt-4 text-sm font-medium text-accent hover:underline"
          >
            İlk anketi oluştur →
          </button>
        </div>
      )}

      {createDialogOpen && (
        <QuestionnaireCreateDialog
          onClose={() => setCreateDialogOpen(false)}
          onCreated={(id) => {
            router.push(`/questionnaires/${id}`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
```

#### 4.3 Create Dialog

**`/components/questionnaires/QuestionnaireCreateDialog.tsx`**
```tsx
"use client";

import { useState } from "react";

export function QuestionnaireCreateDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/questionnaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          questions: [
            {
              questionText: "Örnek Soru",
              questionType: "FREE_TEXT",
              order: 0,
              required: true,
            },
          ],
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Anket oluşturulamadı");
      }

      const { questionnaire } = await response.json();
      onCreated(questionnaire.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Yeni Anket</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Başlık <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Müvekkil Bilgi Formu"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Açıklama
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Anketin amacını açıklayın..."
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !title}
              className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {loading ? "Oluşturuluyor..." : "Oluştur"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              İptal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

### Phase 5: Questionnaire Editor (5-6 hours)

**`/app/(dashboard)/questionnaires/[id]/page.tsx`**
- Full questionnaire editor with drag-and-drop question reordering
- Add/edit/delete questions
- Question type selector
- Options editor for choice questions
- Validation rules
- Preview mode
- Save/publish controls

**`/components/questionnaires/QuestionnaireEditor.tsx`**
- Main editor component
- Question list with reordering
- Add question button
- Settings panel

**`/components/questionnaires/QuestionEditorCard.tsx`**
- Single question editor
- Type-specific configuration
- Options editor for SINGLE/MULTI_CHOICE
- Validation settings

---

### Phase 6: Workflow Integration (2-3 hours)

#### 6.1 Config Form

**`/components/workflows/config-forms/PopulateQuestionnaireConfigForm.tsx`**
```tsx
"use client";

import { useState, useEffect } from "react";

interface PopulateQuestionnaireConfigFormProps {
  initialConfig: {
    questionnaireId?: string;
    title?: string;
    description?: string;
    dueInDays?: number;
  };
  onChange: (config: {
    questionnaireId: string;
    title: string;
    description?: string;
    dueInDays?: number;
  }) => void;
}

export function PopulateQuestionnaireConfigForm({
  initialConfig,
  onChange,
}: PopulateQuestionnaireConfigFormProps) {
  const [questionnaires, setQuestionnaires] = useState<Array<{
    id: string;
    title: string;
    _count: { questions: number };
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [questionnaireId, setQuestionnaireId] = useState(
    initialConfig.questionnaireId || ""
  );
  const [title, setTitle] = useState(initialConfig.title || "");
  const [description, setDescription] = useState(initialConfig.description || "");
  const [dueInDays, setDueInDays] = useState(initialConfig.dueInDays);

  useEffect(() => {
    // Fetch active questionnaires
    fetch("/api/questionnaires?isActive=true")
      .then((res) => res.json())
      .then((data) => {
        setQuestionnaires(data.questionnaires || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (questionnaireId && title) {
      onChange({
        questionnaireId,
        title,
        description: description || undefined,
        dueInDays: dueInDays && dueInDays > 0 ? dueInDays : undefined,
      });
    }
  }, [questionnaireId, title, description, dueInDays, onChange]);

  const selectedQuestionnaire = questionnaires.find((q) => q.id === questionnaireId);

  return (
    <div className="space-y-4">
      {/* Questionnaire Selector */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Anket <span className="text-red-500">*</span>
        </label>
        {loading ? (
          <div className="text-sm text-slate-500">Anketler yükleniyor...</div>
        ) : (
          <select
            value={questionnaireId}
            onChange={(e) => {
              setQuestionnaireId(e.target.value);
              // Auto-fill title if empty
              const q = questionnaires.find((q) => q.id === e.target.value);
              if (q && !title) {
                setTitle(q.title);
              }
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            required
          >
            <option value="">Anket seçin...</option>
            {questionnaires.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title} ({q._count.questions} soru)
              </option>
            ))}
          </select>
        )}
        <p className="mt-1 text-xs text-slate-500">
          Müvekkilin dolduracağı anketi seçin
        </p>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Adım Başlığı <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Örn: Müvekkil Bilgi Formunu Doldurun"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Açıklama
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ek talimatlar veya açıklamalar..."
          rows={3}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Due In Days */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Tamamlanma Süresi (gün)
        </label>
        <input
          type="number"
          min="1"
          value={dueInDays || ""}
          onChange={(e) =>
            setDueInDays(e.target.value ? parseInt(e.target.value) : undefined)
          }
          placeholder="Örn: 7"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-slate-500">
          Müvekkil anketi kaç gün içinde tamamlamalı?
        </p>
      </div>

      {/* Preview */}
      {selectedQuestionnaire && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase mb-2">
            Önizleme
          </p>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h4 className="font-medium text-slate-900">{title || "Başlık"}</h4>
            {description && (
              <p className="mt-1 text-sm text-slate-600">{description}</p>
            )}
            <div className="mt-3 rounded-lg bg-blue-50 p-3">
              <p className="text-sm font-medium text-blue-900">
                📋 {selectedQuestionnaire.title}
              </p>
              <p className="text-xs text-blue-700">
                {selectedQuestionnaire._count.questions} soru
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### 6.2 Execution Component (Client-Facing Form)

**`/components/workflows/execution/PopulateQuestionnaireExecution.tsx`**
```tsx
"use client";

import { useState, useEffect } from "react";

// This component renders the actual questionnaire form for clients to fill out
export function PopulateQuestionnaireExecution({
  stepId,
  config,
  onComplete,
}: {
  stepId: string;
  config: {
    questionnaireId: string;
    title: string;
    description?: string;
  };
  onComplete: (payload: { responseId: string }) => Promise<void>;
}) {
  const [questionnaire, setQuestionnaire] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load questionnaire with questions
    fetch(`/api/questionnaires/${config.questionnaireId}`)
      .then((res) => res.json())
      .then((data) => {
        setQuestionnaire(data.questionnaire);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [config.questionnaireId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Validate required fields
    const newErrors: Record<string, string> = {};
    questionnaire.questions.forEach((q: any) => {
      if (q.required) {
        const answer = answers[q.id];
        if (!answer || (Array.isArray(answer) && answer.length === 0)) {
          newErrors[q.id] = "Bu alan zorunludur";
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);

    try {
      // 1. Create response
      const createRes = await fetch("/api/questionnaire-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionnaireId: config.questionnaireId,
          workflowStepId: stepId,
        }),
      });

      if (!createRes.ok) throw new Error("Response oluşturulamadı");

      const { response } = await createRes.json();

      // 2. Submit answers
      const submitRes = await fetch(`/api/questionnaire-responses/${response.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: questionnaire.questions.map((q: any) => ({
            questionId: q.id,
            ...(q.questionType === "FREE_TEXT"
              ? { answerText: answers[q.id] || "" }
              : { answerJson: answers[q.id] }),
          })),
        }),
      });

      if (!submitRes.ok) throw new Error("Yanıtlar gönderilemedi");

      // 3. Complete workflow step
      await onComplete({ responseId: response.id });
    } catch (err) {
      console.error(err);
      alert("Anket gönderilemedi");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-500">Yükleniyor...</div>;
  }

  if (!questionnaire) {
    return <div className="text-sm text-red-600">Anket bulunamadı</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg bg-blue-50 p-4">
        <h3 className="font-medium text-blue-900">{questionnaire.title}</h3>
        {questionnaire.description && (
          <p className="mt-1 text-sm text-blue-700">{questionnaire.description}</p>
        )}
      </div>

      {questionnaire.questions.map((question: any, idx: number) => (
        <div key={question.id} className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            {idx + 1}. {question.questionText}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </label>

          {question.helpText && (
            <p className="text-xs text-slate-500">{question.helpText}</p>
          )}

          {question.questionType === "FREE_TEXT" && (
            <textarea
              value={answers[question.id] || ""}
              onChange={(e) =>
                setAnswers({ ...answers, [question.id]: e.target.value })
              }
              placeholder={question.placeholder || "Yanıtınızı yazın..."}
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          )}

          {question.questionType === "SINGLE_CHOICE" && (
            <div className="space-y-2">
              {JSON.parse(question.options || "[]").map((option: string) => (
                <label key={option} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={question.id}
                    value={option}
                    checked={answers[question.id] === option}
                    onChange={(e) =>
                      setAnswers({ ...answers, [question.id]: e.target.value })
                    }
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm text-slate-700">{option}</span>
                </label>
              ))}
            </div>
          )}

          {question.questionType === "MULTI_CHOICE" && (
            <div className="space-y-2">
              {JSON.parse(question.options || "[]").map((option: string) => (
                <label key={option} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value={option}
                    checked={(answers[question.id] || []).includes(option)}
                    onChange={(e) => {
                      const current = answers[question.id] || [];
                      const updated = e.target.checked
                        ? [...current, option]
                        : current.filter((o: string) => o !== option);
                      setAnswers({ ...answers, [question.id]: updated });
                    }}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <span className="text-sm text-slate-700">{option}</span>
                </label>
              ))}
            </div>
          )}

          {errors[question.id] && (
            <p className="text-xs text-red-600">{errors[question.id]}</p>
          )}
        </div>
      ))}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
      >
        {submitting ? "Gönderiliyor..." : "Anketi Tamamla"}
      </button>
    </form>
  );
}
```

#### 6.3 Register in Action Config Form

**`/components/workflows/config-forms/ActionConfigForm.tsx`**
```tsx
// Add to imports
import { PopulateQuestionnaireConfigForm } from "./PopulateQuestionnaireConfigForm";

// Add to switch statement
case "POPULATE_QUESTIONNAIRE":
  return (
    <PopulateQuestionnaireConfigForm
      initialConfig={config}
      onChange={onChange}
    />
  );
```

#### 6.4 Register in Execution Components

**`/components/matters/workflows/WorkflowStepCard.tsx`**
```tsx
// Add to imports
import { PopulateQuestionnaireExecution } from "@/components/workflows/execution";

// Add to execution switch
case "POPULATE_QUESTIONNAIRE":
  return (
    <PopulateQuestionnaireExecution
      stepId={step.id}
      config={step.actionConfig as any}
      onComplete={async (payload) => {
        await runStepAction(step.id, "complete", payload);
      }}
    />
  );
```

---

### Phase 7: Display & Response Viewing (3-4 hours)

#### 7.1 Display Component

**`/components/workflows/ActionConfigDisplay.tsx`**
```tsx
// Add to switch statement
case "POPULATE_QUESTIONNAIRE": {
  const questConfig = config as {
    questionnaireId: string;
    title: string;
    description?: string;
    dueInDays?: number;
  };
  return (
    <div className="flex items-start gap-2">
      <FileText className="h-5 w-5 text-purple-600" />
      <div className="flex-1">
        <p className="font-medium text-slate-900">{questConfig.title}</p>
        {questConfig.description && (
          <p className="text-sm text-slate-600">{questConfig.description}</p>
        )}
        {questConfig.dueInDays && (
          <p className="text-xs text-slate-500">
            {questConfig.dueInDays} gün içinde tamamlanmalı
          </p>
        )}
      </div>
    </div>
  );
}
```

#### 7.2 Response Viewer

**`/components/questionnaires/ResponseViewer.tsx`**
- Display completed questionnaire responses
- Show all questions and answers
- Export to PDF functionality
- Response metadata (submitted by, date, etc.)

**`/app/(dashboard)/questionnaires/[id]/responses/page.tsx`**
- List all responses for a questionnaire
- Filter by completion status
- Link to matter/workflow if applicable

---

### Phase 8: UI Integration & Polish (2-3 hours)

1. **Add to Navigation**
   - Add "Anketler" link to dashboard sidebar
   - Icon: ClipboardList or FileQuestion

2. **Add to Workflow Templates Page**
   - Add "Populate Questionnaire" to ACTION_TYPES array
   - Update defaultConfigFor() function

3. **Add to Matter Detail Page**
   - Update ActionType union
   - Update defaultConfigFor() function

4. **Execution Log Display**
   - Show questionnaire completion in step execution log
   - Link to view full response

5. **Tooltips & Help Text**
   - Add helpful tooltips throughout UI
   - Add "?" icons with explanations

---

## 📊 Testing Checklist

### Unit Tests
- [ ] Validation schemas work correctly
- [ ] API endpoints return correct data
- [ ] Workflow handler validates config
- [ ] Workflow handler completes successfully

### Integration Tests
- [ ] Create questionnaire via API
- [ ] Add questions to questionnaire
- [ ] Assign questionnaire in workflow
- [ ] Submit questionnaire response
- [ ] Complete workflow step
- [ ] View responses

### E2E Tests
- [ ] Lawyer creates questionnaire
- [ ] Lawyer adds questionnaire to workflow
- [ ] Client fills out questionnaire
- [ ] Workflow advances after completion
- [ ] Lawyer views response
- [ ] Export response to PDF

### Manual Testing
- [ ] UI is intuitive and accessible
- [ ] Forms validate properly
- [ ] Error messages are clear
- [ ] Loading states work
- [ ] Mobile responsive
- [ ] Turkish translations correct

---

## 🚀 Deployment Steps

1. **Database Migration**
   ```bash
   npx prisma migrate dev --name add_questionnaires
   npx prisma generate
   npx prisma db push
   ```

2. **Seed Sample Data** (optional)
   ```typescript
   // Create sample questionnaire in seed script
   const sampleQuestionnaire = await prisma.questionnaire.create({
     data: {
       title: "Müvekkil Bilgi Formu",
       description: "Yeni müvekkiller için temel bilgi toplama formu",
       createdById: adminUser.id,
       questions: {
         create: [
           {
             questionText: "Tam adınız nedir?",
             questionType: "FREE_TEXT",
             order: 0,
             required: true,
           },
           {
             questionText: "Davada tarafınız nedir?",
             questionType: "SINGLE_CHOICE",
             order: 1,
             required: true,
             options: JSON.stringify(["Davacı", "Davalı", "3. Taraf"]),
           },
         ],
       },
     },
   });
   ```

3. **Deploy**
   - Push changes to repository
   - Run migrations on production
   - Test on staging first
   - Monitor error logs

---

## 🔮 Future Enhancements

### Phase 2 Features (Post-MVP)
1. **Conditional Logic**: Show/hide questions based on previous answers
2. **File Upload Questions**: Allow clients to upload files as answers
3. **Rich Text Editor**: WYSIWYG editor for free text questions
4. **Question Templates**: Pre-built question library by practice area
5. **Auto-Save**: Save progress automatically
6. **Email Reminders**: Send reminders for incomplete questionnaires
7. **Analytics**: Response statistics and insights
8. **Version Control**: Track questionnaire versions
9. **Clone Questionnaire**: Duplicate existing questionnaires
10. **Question Bank**: Reusable question library

### Advanced Features
- **AI-Assisted Answers**: Suggest answers based on context
- **Document Generation**: Generate documents from responses
- **Multi-Language**: Support multiple languages
- **Branching Logic**: Complex conditional flows
- **Integration**: Connect with external forms (Google Forms, Typeform)
- **Signature Integration**: Sign documents directly in questionnaire
- **Payment Integration**: Collect payments with questionnaire
- **Calendar Integration**: Schedule meetings from questionnaire

---

## 📚 Documentation Needs

1. **User Guide**
   - How to create questionnaires
   - Question types explained
   - Best practices for questionnaire design
   - How to use in workflows

2. **Developer Guide**
   - Data model explanation
   - API documentation
   - Handler implementation details
   - Extension points

3. **Admin Guide**
   - Managing questionnaires
   - Viewing responses
   - Exporting data
   - Privacy considerations

---

## ⏱️ Time Estimates

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| 1. Database Schema | Schema, migration, validation | 2-3 hours |
| 2. API Endpoints | CRUD APIs for questionnaires & responses | 3-4 hours |
| 3. Workflow Handler | Handler implementation & registration | 2-3 hours |
| 4. Management UI | List, create, edit questionnaires | 4-5 hours |
| 5. Editor UI | Full questionnaire editor | 5-6 hours |
| 6. Workflow Integration | Config form, execution UI | 2-3 hours |
| 7. Response Viewing | Display responses, export | 3-4 hours |
| 8. Polish & Integration | Navigation, tooltips, testing | 2-3 hours |
| **Total** | | **23-31 hours** |

**Recommended Sprint**: 1 week (5-7 days) for 2 developers

---

## 🎯 Success Criteria

### MVP Completion Checklist
- ✅ Lawyers can create questionnaires with multiple question types
- ✅ Questionnaires can be added to workflows as POPULATE_QUESTIONNAIRE steps
- ✅ Clients can fill out questionnaires in workflow execution
- ✅ Responses are stored and linked to workflow steps
- ✅ Lawyers can view completed responses
- ✅ Basic validation works (required fields, type checking)
- ✅ UI is intuitive and accessible
- ✅ All database relationships work correctly
- ✅ No TypeScript errors
- ✅ E2E flow works: Create → Assign → Fill → Complete → View

### Quality Standards
- All code follows existing patterns (similar to WRITE_TEXT)
- Proper error handling throughout
- Responsive UI works on mobile
- Turkish translations complete and accurate
- Security: Only authorized users can access
- Performance: Forms load quickly (<1s)
- Accessibility: Forms are keyboard navigable

---

## 📝 Notes

- Follow WRITE_TEXT implementation as a reference pattern
- Reuse existing UI components where possible (cards, forms, buttons)
- Keep questionnaire editor simple for MVP - advanced features later
- Consider UX for long questionnaires (progress indicator, sections)
- Plan for GDPR compliance (data export, deletion)
- Consider mobile experience for client-facing forms

---

**Status**: 📋 Ready for Implementation  
**Next Step**: Review plan with team, then begin Phase 1 (Database Schema)


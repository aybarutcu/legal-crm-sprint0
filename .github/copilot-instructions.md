# Legal CRM – Copilot Instructions

## System Architecture
- **Next.js 15 App Router**: Main app logic in `app/(dashboard)/*`, with server loaders fetching Prisma data and passing it to client components (e.g., `app/(dashboard)/matters/[id]/page.tsx` → `components/matters/MatterDetailClient.tsx`).
- **API**: REST endpoints in `app/api/*`, always wrap handlers with `withApiHandler` (`lib/api-handler.ts`) for auth, rate limiting, logging, and error translation.
- **ORM**: Use singleton Prisma client from `lib/prisma.ts`. Most tables have soft delete (`deletedAt`, `deletedBy`); always guard queries with `deletedAt: null` (see `lib/workflows/handlers/signature-client.ts` for examples).
- **Path Alias**: Use `@/*` for root imports (see `tsconfig.json`).

## Data Model Overview
- **Core Entities**: User (roles: ADMIN/LAWYER/PARALEGAL/CLIENT), Contact (types: LEAD/CLIENT/OTHER), Matter (status: OPEN/IN_PROGRESS/CLOSED), Document (versioned, S3 storage), Task/Event/Workflow.
- **Relations**: Extensive linking (e.g., Matter → Contact via MatterContact, User → Matter via ownership/team). Use Prisma relations for queries.
- **Enums**: Define status, types, roles (e.g., ActionType: APPROVAL/SIGNATURE/REQUEST_DOC/PAYMENT/CHECKLIST/WRITE_TEXT/POPULATE_QUESTIONNAIRE/AUTOMATION_EMAIL/AUTOMATION_WEBHOOK). Keep aligned with `prisma/schema.prisma`.
- **JSON Fields**: Flexible configs (e.g., `actionConfig`, `contextData`, `conditionConfig`) for dynamic behavior.
- **Soft Delete**: Query with `where: { deletedAt: null }` on most models to exclude soft-deleted records.
- **Schema Changes**: Always create migrations via `npx prisma migrate dev --name <description>`. Update TypeScript types, Zod schemas in `lib/validation/*`, and workflow schemas in `lib/workflows/schema.ts` to match. Run `npx prisma generate` after schema changes.

## Workflow System Architecture
- **Templates vs Instances**: `WorkflowTemplate` (reusable blueprints) → `WorkflowInstance` (running executions linked to matters/contacts).
- **Steps Structure**: `WorkflowTemplateStep` (template steps) → `WorkflowInstanceStep` (runtime steps with state).
- **ReactFlow Integration**: Visual canvas builder using ReactFlow with nodes (`StepNode`) and edges for dependencies/branching.
- **Node Handles/Ports**: Steps have input handles (left) and multiple output handles (right) for branching (e.g., APPROVAL has "approve"/"reject" handles).
- **Dependency Logic**: Steps can depend on multiple predecessors with `dependencyLogic` ("ALL"/"ANY"/"CUSTOM") - controls when step becomes ready.
- **Branching**: `nextStepOnTrue`/`nextStepOnFalse` for conditional jumps (e.g., approval branches), visualized as colored edges ("Approve" green, "Reject" red).
- **Canvas Positions**: `positionX`/`positionY` stored per step for visual layout; preserved during edits.
- **Validation**: Cycle detection, self-dependency prevention, and dependency resolution in `lib/workflows/dependency-resolver.ts`.

## API & Auth
- **Handler Pattern**: Wrap every API route with `withApiHandler<TParams>` for consistent auth, rate limiting, error handling:
  ```typescript
  export const GET = withApiHandler<{ id: string }>(async (req, { params, session }) => {
    const { id } = await params;
    // Access session.user for auth checks
    // Return NextResponse.json(...)
  }, { requireAuth: true });
  ```
- **Authorization**: Use `assertMatterAccess(user, matterId)` from `lib/authorization.ts` before exposing matter data. Workflow-specific checks in `lib/workflows/permissions.ts`.
- **Transactions**: Bundle multi-step writes inside `prisma.$transaction` blocks (see `app/api/workflows/instances/[id]/route.ts`, `app/api/workflows/steps/[id]/complete/route.ts` for patterns).
- **Session**: NextAuth session (`session.user.id`, `session.user.role`) powers RBAC; fetch with `getAuthSession()` from `lib/auth.ts` on server.
- **Error Mapping**: `withApiHandler` auto-translates Prisma errors (P2002 → 409 conflict, P2025 → 404 not found).
- **Rate Limiting**: Default is 100 requests per 15 minutes per IP+endpoint combo. Override via `rateLimit` option in `withApiHandler`. Uses in-memory store (Redis planned).
- **Logging**: `withApiHandler` auto-logs requests with duration. Use `lib/logger.ts` for structured logging elsewhere. All logs include timestamp, level, and context.

## Workflow Engine
- **Initialization**: Import `@/lib/workflows` (not `@/lib/workflows/runtime`) to auto-register action handlers via `lib/workflows/handlers/index.ts` side-effect.
- **Runtime**: `lib/workflows/runtime.ts` manages `ActionState` transitions, preserves `actionData.config` + `actionData.history`, and exposes `ctx.updateContext` to mutate `WorkflowInstance.contextData`; enforce transitions with `assertTransition`.
- **Action Handlers**: Implement handlers extending base interface, override in registry. Built-in handlers: ApprovalActionHandler, SignatureActionHandler, RequestDocActionHandler, PaymentActionHandler, TaskActionHandler, ChecklistActionHandler, WriteTextActionHandler, PopulateQuestionnaireActionHandler, AutomationEmailActionHandler, AutomationWebhookActionHandler.
- **Schemas**: Template/step/context schemas in `lib/workflows/schema.ts`, `lib/validation/workflow.ts`, `lib/workflows/context-schema.ts`; keep aligned with `prisma/schema.prisma` enums.
- **Branching/Dependencies**: Use helpers in `lib/workflows/conditions` and `dependency-resolver.ts` rather than reimplementing graph logic.
- **Notifications**: Email notifications gated by `ENABLE_WORKFLOW_NOTIFICATIONS` env var, built via `lib/workflows/notifications.ts`; honor `SMTP_FROM`.

## Frontend Patterns
- **Server → Client**: Server components serialize Date instances to ISO strings before passing to clients (`.toISOString()`). Keep props JSON-safe—no Date objects, functions, or undefined values.
  ```typescript
  // Server component
  const detail: MatterDetail = {
    openedAt: matter.openedAt.toISOString(),
    nextHearingAt: matter.nextHearingAt?.toISOString() ?? null,
  };
  return <MatterDetailClient matter={detail} />;
  ```
- **Client Components**: Mark interactive components with `"use client"` directive at top. Pattern: Server component fetches data → passes serialized props to client component for interactivity (see `app/(dashboard)/matters/[id]/page.tsx` → `components/matters/MatterDetailClient.tsx`).
- **Client State**: Use SWR for data fetching in client components (`components/dashboard/overview-client.tsx`, `components/events/EventsPageClient.tsx`). Pass `fallbackData` for SSR hydration, set `revalidateOnFocus: false` to prevent aggressive refetching. For mutations, call API routes and `mutate()` to revalidate.
- **Workflow UI**: Canvas editors in `components/workflows/*` maintain both step state and editable JSON config strings—update both when adding fields. Detail panes read `actionData.config`/`history`.
- **Dynamic Rendering**: Add `export const dynamic = 'force-dynamic'` to pages with real-time data or session-dependent content to prevent Next.js 15 static optimization issues (see `app/(marketing)/page.tsx`, `app/(dashboard)/documents/page.tsx`).

## Storage & Integrations
- **File Storage**: `lib/storage.ts` handles S3/MinIO uploads. Without S3 env vars, falls back to `S3_FAKE_*` URLs. Pair presigned upload URLs from `/api/uploads` with document records.
- **Email**: SMTP transporters in `lib/mail/*`; configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` (defaults to `Legal CRM <noreply@legalcrm.local>`).
- **Calendar**: MailHog for dev, production SMTP for prod. Defaults like `CALENDAR_DEFAULT_REMINDER_MINUTES` in `prisma/seed.ts`.

## Client Portal Specifics
- **Routing**: Portal lives in `app/(portal)/portal/*` with separate auth flow via `app/portal/login`, `app/portal/activate`, `app/portal/password-reset`.
- **Role Check**: Portal pages redirect non-CLIENT users to `/dashboard`; use `session.user.role === "CLIENT"` check in server components.
- **Portal API**: Routes under `app/api/portal/*` typically set `requireAuth: false` (e.g., password reset) since they handle unauthenticated CLIENT users.
- **Data Scoping**: Portal views filter by `client.userId` (see `app/(portal)/portal/page.tsx`):
  ```typescript
  // Show only matters where the logged-in CLIENT is the client
  where: { client: { userId: session.user.id } }
  ```
- **Activation Flow**: Clients receive invitation → activate via token → set password → login. Token validation in `app/api/clients/activate/route.ts`.
- **Access Control**: Portal users see only their own matters, documents, approvals, and events—never use global queries without `client.userId` filter.

## Document Versioning Patterns
- **Version Model**: Documents use self-referential relation (`parentDocumentId → Document.versions[]`) with auto-incrementing `version` field (starts at 1).
- **Creating Versions**: 
  ```typescript
  // Get latest version number
  const aggregate = await prisma.document.aggregate({
    where: { filename, matterId },
    _max: { version: true },
  });
  const nextVersion = getNextDocumentVersion(aggregate._max.version); // lib/documents/version.ts
  ```
- **Version Conflict**: Return 409 if client-provided version doesn't match expected version (optimistic locking).
- **Storage Key**: Versions stored as `documents/{documentId}/v{version}/{filename}` in S3/MinIO.
- **Audit Trail**: Version 1 logs `document.create`, subsequent versions log `document.version` (see `app/api/documents/route.ts`).
- **Querying**: Fetch all versions via `include: { versions: true }` or latest via `orderBy: { version: 'desc' }, take: 1`.

## Document/Folder Management Patterns
- **Folder Hierarchy**: Two-level structure: root folders (`/Matters`, `/Contacts`) contain entity subfolders (`/Matters/{title}`, `/Contacts/{firstName lastName}`).
- **Auto-Creation**: Document uploads with `matterId` or `contactId` auto-create folders if missing (see `app/api/documents/route.ts` lines 149-250).
- **Folder Name Sync**: Matter/contact name changes auto-sync folder names via transaction blocks (see `app/api/matters/[id]/route.ts` lines 80-115, `app/api/contacts/[id]/route.ts` lines 95-130).
- **Access Control**: 4-tier scopes (PUBLIC, ROLE_BASED, USER_BASED, PRIVATE) with optional access grants via `FolderAccess`/`DocumentAccess` models.
- **Transaction Pattern**: Wrap folder operations in `prisma.$transaction` to ensure atomicity:
  ```typescript
  await prisma.$transaction(async (tx) => {
    const updated = await tx.matter.update({ where: { id }, data: payload });
    if (payload.title && payload.title !== existing.title) {
      const folder = await tx.documentFolder.findFirst({ where: { matterId: id } });
      if (folder) {
        await tx.documentFolder.update({ where: { id: folder.id }, data: { name: payload.title } });
        await recordAuditLog({ action: 'folder.name_synced', metadata: { oldName, newName } });
      }
    }
  });
  ```
- **Migration**: Use `scripts/sync-folder-names.ts` to fix folder name drift (`--dry-run` to preview).

## Task/Event/Calendar Integration
- **Access Filters**: Use role-based helpers from `lib/tasks/service.ts` and `lib/events/service.ts`:
  ```typescript
  buildTaskAccessFilter(user)    // Returns OR filter: assignee OR matter owner
  buildEventAccessFilter(user)   // Returns OR filter: organizer OR calendar owner OR matter owner
  ```
- **Calendar Sync**: Two-way sync with Google Calendar via `lib/google/calendar.ts`:
  - Push: `pushEventToGoogle()` creates/updates external events
  - Pull: `performUserCalendarSync()` in `lib/events/sync.ts` fetches Google events, upserts local Event records
  - Sync triggered via `POST /api/calendar/sync` (returns 202 if queued, 200 if immediate)
- **Event-Matter Link**: Events optionally link to Matter via `matterId`; filtered by matter access when present.
- **Task-Workflow Link**: Tasks created by workflows store `workflowStepId`; completion may auto-advance workflow steps.
- **Calendar Providers**: Support Google OAuth (via NextAuth Account), extendable to Microsoft/others. Provider stored in `Calendar.provider` enum.
- **Reminders**: Event reminders configured via `EventReminder` model; defaults set in `prisma/seed.ts` (`CALENDAR_DEFAULT_REMINDER_MINUTES`).

## Testing & Quality
- **Test Structure**:
  - Unit tests: `tests/unit/**/*.spec.ts` (Vitest)
  - API tests: `tests/api/**/*.spec.ts` (Vitest with mock auth)
  - E2E tests: `tests/e2e/**/*.spec.ts` (Playwright)
- **Database Required**: Many tests require PostgreSQL running via `docker compose up -d`
- **Known Test Issues**:
  - Workflow dependency tests use old schema (tests have `dependsOn` array, implementation uses `WorkflowInstanceDependency` edge model)
  - Missing `lib/workflows/conditions/evaluator.ts` - tests exist but implementation doesn't
  - Some handler RBAC tests have TypeScript type mismatches (WorkflowRuntimeContext generics)
- **Running Tests**:
  ```bash
  npm run test           # Vitest unit/API tests
  npm run e2e            # Playwright E2E tests  
  npm run lint           # ESLint (currently broken due to @rushstack/eslint-patch incompatibility)
  ```
- **Mock Patterns**: API tests use `createMockSession()` helpers; workflow tests mock Prisma transaction contexts.

## Background Workers & Build
- **Reminder Workers**: `lib/tasks/reminder-worker.ts` and `lib/events/reminder-worker.ts` start background jobs on module load
- **Build Guards**: Workers check `NEXT_PHASE === "phase-production-build"` to prevent DB access during build
- **Dynamic Pages**: Marketing page uses `export const dynamic = 'force-dynamic'` to avoid static generation issues with Next.js 15
- **Worker Imports**: Dashboard layout imports workers as side effects (`import "@/lib/events/reminder-worker"`)

## Dev Workflow
- **Bootstrap**: 
  ```bash
  npm install
  docker compose up -d          # PostgreSQL, MinIO, MailHog, Redis
  npx prisma migrate dev --name init
  npx prisma db seed
  npm run dev                   # http://localhost:3000
  ```
- **Default Credentials** (from seed):
  - Admin: `admin@legalcrm.local` / `admin123`
  - Lawyer: `lawyer@legalcrm.local` / `lawyer123`
  - Paralegal: `paralegal@legalcrm.local` / `paralegal123`
  - Client: `client@legalcrm.local` / `client123`
- **Reset**: `./scripts/dev-reset.sh` runs `prisma migrate reset --force` (drops DB, recreates schema, seeds data).
- **Tests**: 
  - `npm run lint` (ESLint)
  - `npm run test` (Vitest unit/API tests in `tests/unit`, `tests/api`)
  - `npm run e2e` (Playwright in `tests/e2e`)
  - CI artifacts written to `artifacts/` (junit XML)
- **OpenAPI**: Edit `docs/openapi.yaml`, run `node scripts/gen-openapi.js` to update `public/openapi.json`.
- **Feature Scripts**: Quick repro scripts in `scripts/` (e.g., `test-lead-workflow.ts`, `test-context-ui.ts`)—execute with `tsx scripts/<name>.ts`.
- **Docker Services**:
  - PostgreSQL: `localhost:5432`
  - MinIO Console: `http://localhost:9001` (minioadmin/minioadmin)
  - MailHog UI: `http://localhost:8025` (view outgoing emails)
  - Redis: `localhost:6379`

## Environment Variables
- See `.env.example` for full reference. Key vars:
  - `DATABASE_URL`: PostgreSQL connection string
  - `NEXTAUTH_URL`, `NEXTAUTH_SECRET`: Auth config
  - `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`: S3/MinIO
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`: Email
  - `ENABLE_WORKFLOW_NOTIFICATIONS`: Toggle workflow emails (default: false)
- Mirror new vars into `.env.example` and document in `docs/MASTER-SYSTEM-DOCUMENTATION.md`.

## Reference
- **Master Docs**: `docs/MASTER-SYSTEM-DOCUMENTATION.md` (full system, schema, API, workflows)
- **ADRs**: `docs/adr/` (001-tech-stack, 002-data-storage, 003-auth, 004-calendar-integration, 005-rbac)
- **Runbooks**: `docs/runbooks/*` (operational guides for calendar, workflows, reminders)
- **CI/CD**: `.github/workflows/ci.yml` (lint, test, e2e pipeline)

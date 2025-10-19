# Legal CRM - AI Coding Agent Instructions

## Project Overview
Legal case management system for law firms. Built with Next.js 15 (App Router), TypeScript, Prisma, PostgreSQL. Manages contacts, matters (cases), documents, workflows, tasks, calendar events, and a client portal.

**Stack**: Next.js 15 · TypeScript · Prisma · PostgreSQL · NextAuth · MinIO/S3 · Redis · TailwindCSS · shadcn/ui

## Critical Architecture Patterns

### 1. API Route Handler (MANDATORY)
**Every API route MUST use `withApiHandler`** from `lib/api-handler.ts`:

```typescript
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler<{ id: string }>(
  async (req, { session, params }) => {
    const { id } = await params; // Next.js 15 requires await
    // session available if requireAuth: true
    // Just throw errors - auto-caught and mapped
    return NextResponse.json({ data });
  },
  { requireAuth: true, rateLimit: { limit: 100, windowMs: 60000 } }
);
```

**Why**: Auto error handling, Prisma error mapping (P2002→409, P2025→404), rate limiting, auth checks, request logging, performance tracking.

### 2. Server/Client Component Split (Next.js 15 App Router)
Server components (default) fetch data, client components handle interactivity.

```tsx
// app/(dashboard)/contacts/[id]/page.tsx - SERVER COMPONENT
export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Next.js 15 pattern
  const session = await getAuthSession();
  const contact = await prisma.contact.findUnique({ where: { id }, include: { ... } });
  
  return <ContactDetailClient contact={contact} currentUser={session.user} />;
}
```

```tsx
// _components/contact-detail-client.tsx - CLIENT COMPONENT
"use client"; // REQUIRED for useState, useEffect, onClick, etc.

export function ContactDetailClient({ contact, currentUser }) {
  const [editing, setEditing] = useState(false);
  // All interactive logic here
}
```

**Never** use Prisma in client components - fetch in server component/API, pass via props.

### 3. Workflow System - Pluggable Handler Registry
Complex engine for multi-step processes (onboarding, approvals, document collection).

**Core Concepts**:
- `WorkflowTemplate` - Reusable process blueprint with ordered steps
- `WorkflowInstance` - Specific execution attached to Contact/Matter
- `WorkflowInstanceStep` - Individual step with `actionState` (PENDING → READY → IN_PROGRESS → COMPLETED)
- `IActionHandler` - Implements behavior for each `ActionType`

**Handler Registry** (`lib/workflows/registry.ts`):
```typescript
class ActionRegistry {
  register(handler: IActionHandler): void;
  get(type: ActionType): IActionHandler;
}
```

Handlers registered in `lib/workflows/handlers/index.ts`:
```typescript
export function registerDefaultWorkflowHandlers(): void {
  actionRegistry.override(new ApprovalActionHandler());
  actionRegistry.override(new SignatureActionHandler());
  actionRegistry.override(new RequestDocActionHandler());
  actionRegistry.override(new PaymentActionHandler());
  actionRegistry.override(new TaskActionHandler());
  actionRegistry.override(new ChecklistActionHandler());
  actionRegistry.override(new WriteTextActionHandler());
  actionRegistry.override(new PopulateQuestionnaireActionHandler());
}
```

**Available Action Types** (8 total):
- `APPROVAL_LAWYER` - Internal approval by lawyer
- `SIGNATURE_CLIENT` - Client e-signature request
- `REQUEST_DOC_CLIENT` - Document request from client
- `PAYMENT_CLIENT` - Payment request from client
- `TASK` - Task assignment
- `CHECKLIST` - Multi-item checklist
- `WRITE_TEXT` - Text input/writing task
- `POPULATE_QUESTIONNAIRE` - Dynamic questionnaire generation

**Creating New Workflow Action**:
1. Add to `ActionType` enum in `prisma/schema.prisma`
2. Create handler class implementing `IActionHandler<TConfig, TData>`
3. Implement: `validateConfig()`, `canStart()`, `start()`, `complete()`, `fail()`, `getNextStateOnEvent()`
4. Register in `lib/workflows/handlers/index.ts`
5. Add to `actionTypeSchema` in `lib/validation/workflow.ts` (prevents 422 errors)

Example handler structure:
```typescript
export class CustomActionHandler implements IActionHandler<CustomConfig, CustomData> {
  readonly type = ActionType.CUSTOM_ACTION;
  
  validateConfig(config: CustomConfig): void {
    customConfigSchema.parse(config); // Zod validation
  }
  
  canStart(ctx: WorkflowRuntimeContext): boolean {
    return ctx.actor?.role === Role.LAWYER; // Permission check
  }
  
  async start(ctx: WorkflowRuntimeContext): Promise<ActionState> {
    // Initialize step data, send notifications, etc.
    return ActionState.IN_PROGRESS;
  }
  
  async complete(ctx: WorkflowRuntimeContext, payload: unknown): Promise<ActionState> {
    // Validate payload, update ctx.data, update ctx.context
    ctx.updateContext({ customField: "value" }); // Persists to instance
    return ActionState.COMPLETED;
  }
}
```

**Workflow Context Persistence**: Use `ctx.updateContext()` to store data accessible to subsequent steps (e.g., questionnaire responses, approval decisions).

**Workflow Lifecycle**:
- `DRAFT` → Workflow created but not started
- `ACTIVE` → Running, steps can be executed
- `PAUSED` → Temporarily stopped (manual)
- `COMPLETED` → All required steps finished
- `CANCELLED` → Stopped before completion

**Step State Transitions**:
- `PENDING` → Not yet ready (blocked by prior steps)
- `READY` → Can be started
- `IN_PROGRESS` → Being worked on
- `COMPLETED` → Successfully finished
- `FAILED` → Error occurred
- `SKIPPED` → Manually skipped (if not required)

**Critical**: Only steps with `actionState: READY` can be started. Use `/api/workflows/instances/[id]/steps/[stepId]/start` and `/complete` endpoints.

### 4. Role-Based Access Control (RBAC)
Four roles: `ADMIN | LAWYER | PARALEGAL | CLIENT` (no default in schema).

**Middleware** (`middleware.ts`):
- Redirects CLIENTs to `/portal`
- Protects `/dashboard/admin/*` for ADMIN only
- Add to `routeRolePolicies` array for new protected routes

**API-level checks** (`lib/rbac.ts`):
```typescript
import { assertRole } from "@/lib/rbac";

assertRole({ userRole: session.user.role, allowedRoles: [Role.ADMIN, Role.LAWYER] });
// Throws "forbidden" error if fails (auto-caught by withApiHandler)
```

**Authorization helper** (`lib/authorization.ts`):
```typescript
import { assertCanModifyResource } from "@/lib/authorization";

await assertCanModifyResource(session.user, matter.ownerId, matter.teamMembers);
// Checks ownership or team membership
```

## Database Patterns

### Soft Deletes (Standard Pattern)
Most models have `deletedAt` and `deletedBy`. **Never hard delete** - use soft delete:
```typescript
await prisma.matter.update({
  where: { id },
  data: { deletedAt: new Date(), deletedBy: session.user.id }
});

// Exclude in queries
const matters = await prisma.matter.findMany({ where: { deletedAt: null } });
```

### Transaction for Multi-Step Operations
```typescript
await prisma.$transaction(async (tx) => {
  const matter = await tx.matter.create({ data: matterData });
  await tx.auditLog.create({ data: { action: "MATTER_CREATED", entityId: matter.id } });
  await tx.task.createMany({ data: initialTasks });
});
```

### Audit Logging (Required for Important Actions)
```typescript
import { createAuditLog } from "@/lib/audit";

await createAuditLog({
  action: "CONTACT_UPDATED",
  actorId: session.user.id,
  entityType: "Contact",
  entityId: contact.id,
  metadata: { changes: { field: "oldValue → newValue" } }
});
```

### Key Schema Relationships
- **Contact ↔ Matter**: Many-to-many via `MatterParty` (role: PLAINTIFF, DEFENDANT, etc.)
- **Contact.type**: LEAD → CLIENT conversion via `lib/contact-to-client.ts`
- **User ↔ Contact**: One-to-one (for client portal access via `userId` field)
- **User ↔ Matter**: One-to-many (ownership via `ownerId`) and many-to-many (team via `MatterTeamMember`)
- **WorkflowInstance**: Attached to Contact or Matter, has ordered `WorkflowInstanceStep[]`
- **Document → Matter/Contact**: Belongs to one via `matterId` or `contactId`
- **Document versioning**: Parent-child via `parentDocumentId`

## Key Development Workflows

### Local Environment Setup
```bash
npm install
docker compose up -d  # Postgres:5432, MinIO:9000/9001, Redis:6379, MailHog:1025/8025
cp .env.example .env
npx prisma migrate dev --name init
npm run db:seed       # Creates 4 users, 7 contacts, 6 matters, workflow templates
npm run dev           # http://localhost:3000
```

**Seed Users** (all password: `password123`):
- `admin@legalcrm.local` (ADMIN)
- `lawyer@legalcrm.local` (LAWYER)
- `paralegal@legalcrm.local` (PARALEGAL)

**MailHog UI**: http://localhost:8025 (catch all emails)

### Quick Database Reset
```bash
./scripts/dev-reset.sh  # Drops DB, recreates, migrates, seeds
```

### Testing
```bash
npm run test     # Vitest (tests/unit/, tests/api/)
npm run e2e      # Playwright (tests/e2e/)
npm run lint     # ESLint
npm run format   # Prettier
```

### Generate OpenAPI Schema
```bash
node scripts/gen-openapi.js  # Updates public/openapi.json
```

## Project-Specific Conventions

### File Upload Flow (Direct S3)
1. Client: `POST /api/uploads` → `{ url, key }` (signed URL)
2. Client: PUT to signed URL (direct to MinIO/S3, no Next.js proxy)
3. Client: `POST /api/documents` with `{ storageKey: key, filename, matterId, ... }`

**Why**: Offloads bandwidth from Next.js server. See `lib/storage.ts`.

**Download Flow**: Request document → server checks permissions → generates presigned GET URL (15 min expiry) → client downloads from S3.

### Client Invitation & Portal Access
**Invitation Flow**:
1. Lawyer invites client: `POST /api/clients/invite` (creates User + Contact, sends email)
2. Client receives email with activation link
3. Client sets password: `POST /api/clients/activate` with token
4. Client can login at `/portal/login`

**Critical**: User.role has NO DEFAULT - must be explicitly set during creation. This prevents accidental LAWYER user creation during client activation.

### Zod Validation Pattern
All API inputs validated via `lib/validation/*.ts`:
```typescript
import { matterCreateSchema } from "@/lib/validation/matter";

const body = await req.json();
const validated = matterCreateSchema.parse(body); // Throws ZodError
// withApiHandler auto-catches ZodError → 400 with error details
```

### Calendar Integration
- Google Calendar sync via OAuth (`lib/google/calendar.ts`)
- ICS feed generation for external calendar apps (`lib/events/ics.ts`)
- Reminder service runs every 60s (`scripts/send-reminders.ts`)
- Settings at `/dashboard/settings/calendar`

### Environment Variables (Critical)
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/legalcrm
NEXTAUTH_SECRET=<random-32-char-string>
NEXTAUTH_URL=http://localhost:3000

S3_ENDPOINT=http://localhost:9000
S3_BUCKET=legalcrm
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_FORCE_PATH_STYLE=true

SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@legalcrm.local

ICS_SIGNING_SECRET=<random-string>
CLIENT_INVITE_SECRET=<random-string>
```

See `.env.example` for full list.

## Common Pitfalls & Solutions

❌ **Don't**: Create API routes without `withApiHandler`  
✅ **Do**: Always wrap with `withApiHandler` for error handling, auth, rate limiting

❌ **Don't**: Forget `"use client"` on interactive components  
✅ **Do**: Add to any component using `useState`, `useEffect`, event handlers

❌ **Don't**: Use Prisma in client components  
✅ **Do**: Fetch in server components or API routes, pass data via props

❌ **Don't**: Hard delete records  
✅ **Do**: Soft delete with `deletedAt`/`deletedBy` fields

❌ **Don't**: Forget to `await params` in Next.js 15  
✅ **Do**: `const { id } = await params;` in API routes and page components

❌ **Don't**: Skip audit logs for important actions  
✅ **Do**: Call `createAuditLog()` for CRUD on matters, contacts, documents

❌ **Don't**: Create users with default role or auto-create in auth  
✅ **Do**: Explicitly set role during user creation via controlled endpoints (ADMIN, LAWYER, PARALEGAL, CLIENT)

## Known Issues & Historical Fixes

### Fixed: Client Invitation Auth Bug (Oct 16, 2025)
**Problem**: Clients logging in after activation created duplicate LAWYER users.  
**Root Cause**: Auth credentials provider auto-created users with default `role: LAWYER`.  
**Fix**: Removed auto-user creation from `lib/auth.ts` and `@default(LAWYER)` from schema. Users must be explicitly created before login.

### Fixed: WRITE_TEXT Validation Errors (Oct 16, 2025)
**Problem**: 422 errors when saving templates/instances with WRITE_TEXT steps.  
**Root Cause**: `actionTypeSchema` in `lib/validation/workflow.ts` missing WRITE_TEXT enum value.  
**Fix**: Added WRITE_TEXT to actionTypeSchema and all inline enums in workflow APIs.

## Documentation Map

- **Master Docs**: `docs/MASTER-SYSTEM-DOCUMENTATION.md` (1000+ lines, complete system reference)
- **Sprint Roadmap**: `docs/SPRINT-ROADMAP.md` (completed features, backlog)
- **Seed Data**: `docs/SEED-DATA.md` (test users, contacts, matters)
- **Workflow Backlog**: `docs/features/workflow/WORKFLOW-BACKLOG.md` (enhancement roadmap)
- **Workflow Docs**: `docs/features/workflow/*.md` (implementation guides, context usage)
- **ADRs**: `docs/adr/*.md` (architectural decisions)
- **Runbooks**: `docs/runbooks/*.md` (operational guides)
- **OpenAPI**: `/api/openapi` or `public/openapi.json`

## Pre-Flight Checklist for Changes

1. **API route?** → Use `withApiHandler`, validate with Zod schemas
2. **Interactive UI?** → Add `"use client"` directive
3. **New workflow action?** → Implement `IActionHandler`, register in `handlers/index.ts`
4. **Database change?** → Check for soft delete fields, use transactions for multi-step
5. **New protected route?** → Update `middleware.ts` policies
6. **Important action?** → Add audit log
7. **New environment variable?** → Update `.env.example`
